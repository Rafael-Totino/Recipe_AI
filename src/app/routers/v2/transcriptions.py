# src/app/routers/v2/transcriptions.py
"""
Transcription job routes for async processing.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from src.app.deps import get_current_user, CurrentUser
from src.app.domain.errors import (
    QuotaExceededError,
    JobNotFoundError,
    StorageError,
)
from src.app.domain.models import JobStatus
from src.app.infra.db.supabase_jobs_repo import (
    SupabaseJobQueueRepository,
    SupabaseQuotaRepository,
)
from src.app.infra.storage.r2_provider import R2StorageProvider
from src.app.services.quota_service import QuotaService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v2/transcriptions", tags=["Transcriptions V2"])


# =============================================================================
# Request/Response Models
# =============================================================================

class CreateJobRequest(BaseModel):
    """Request to create a transcription job."""
    object_key: str = Field(..., description="Storage key from signed-upload")
    recipe_id: Optional[str] = Field(None, description="Optional associated recipe ID")
    estimated_duration_sec: int = Field(
        default=300,
        ge=1,
        le=7200,
        description="Estimated audio duration in seconds (for quota)"
    )
    priority: int = Field(default=0, ge=0, le=10, description="Job priority (higher = first)")


class TranscriptionSegment(BaseModel):
    """A segment of transcribed audio."""
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    text: str = Field(..., description="Transcribed text for this segment")


class JobResponse(BaseModel):
    """Response with job details."""
    id: str = Field(..., description="Job ID")
    status: str = Field(..., description="Job status: QUEUED, RUNNING, DONE, FAILED, CANCELLED")
    object_key: str = Field(..., description="Storage key of the media file")
    recipe_id: Optional[str] = Field(None, description="Associated recipe ID")
    
    # Timing
    created_at: Optional[datetime] = Field(None, description="When job was created")
    started_at: Optional[datetime] = Field(None, description="When processing started")
    finished_at: Optional[datetime] = Field(None, description="When processing finished")
    
    # Progress
    attempt_count: int = Field(default=0, description="Number of processing attempts")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    
    # Results (only present when status=DONE)
    transcript_text: Optional[str] = Field(None, description="Full transcription text")
    segments: Optional[List[TranscriptionSegment]] = Field(None, description="Timed segments")
    language: Optional[str] = Field(None, description="Detected/specified language")
    duration_sec: Optional[int] = Field(None, description="Audio duration in seconds")
    model_version: Optional[str] = Field(None, description="Whisper model used")


class JobListResponse(BaseModel):
    """Response with list of jobs."""
    jobs: List[JobResponse]
    total: int
    limit: int
    offset: int


class QuotaResponse(BaseModel):
    """Response with quota information."""
    minutes_used: int = Field(..., description="Minutes used today")
    minutes_remaining: int = Field(..., description="Minutes remaining today")
    daily_limit: int = Field(..., description="Daily limit in minutes")
    jobs_count: int = Field(..., description="Number of jobs today")


# =============================================================================
# Helper Functions
# =============================================================================

def _get_job_repo() -> SupabaseJobQueueRepository:
    """Get job repository instance."""
    return SupabaseJobQueueRepository()


def _get_quota_service() -> QuotaService:
    """Get quota service instance."""
    return QuotaService()


def _get_storage() -> R2StorageProvider:
    """Get storage provider instance."""
    try:
        return R2StorageProvider()
    except StorageError:
        return None


def _job_to_response(job) -> JobResponse:
    """Convert domain job to response model."""
    segments = None
    if job.segments_json:
        segments = [
            TranscriptionSegment(
                start=seg.get("start", 0),
                end=seg.get("end", 0),
                text=seg.get("text", ""),
            )
            for seg in job.segments_json
        ]
    
    return JobResponse(
        id=str(job.id),
        status=job.status.value,
        object_key=job.object_key,
        recipe_id=str(job.recipe_id) if job.recipe_id else None,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        attempt_count=job.attempt_count,
        error_message=job.error_message,
        transcript_text=job.transcript_text,
        segments=segments,
        language=job.language,
        duration_sec=job.duration_sec,
        model_version=job.model_version,
    )


# =============================================================================
# Routes
# =============================================================================

@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_transcription_job(
    request: CreateJobRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    user_id = current_user.id
    """
    Create a new transcription job.
    
    The job will be queued and processed asynchronously by a worker.
    Poll GET /v2/transcriptions/jobs/{job_id} to check status.
    
    Prerequisites:
    1. Upload file via POST /v2/media/signed-upload
    2. PUT file to the returned upload_url
    3. Call this endpoint with the object_key
    """
    # Validate object key belongs to user
    if not request.object_key.startswith(f"users/{user_id}/"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Object key does not belong to this user",
        )
    
    # Verify file exists in storage (optional but recommended)
    storage = _get_storage()
    if storage:
        try:
            if not storage.object_exists(request.object_key):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File not found in storage. Please upload first.",
                )
        except StorageError as e:
            logger.warning("Could not verify file existence: %s", e)
    
    # Check quota
    quota_service = _get_quota_service()
    estimated_minutes = max(1, request.estimated_duration_sec // 60)
    
    try:
        quota_check = quota_service.reserve_minutes(
            user_id=UUID(user_id),
            estimated_minutes=estimated_minutes,
        )
    except QuotaExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily quota exceeded. Remaining: {e.minutes_remaining} minutes.",
        )
    
    # Create job
    job_repo = _get_job_repo()
    
    try:
        job = job_repo.enqueue_transcription_job(
            user_id=UUID(user_id),
            object_key=request.object_key,
            recipe_id=UUID(request.recipe_id) if request.recipe_id else None,
            estimated_duration_sec=request.estimated_duration_sec,
            priority=request.priority,
        )
        
        logger.info(
            "Created transcription job: id=%s, user=%s, object_key=%s",
            job.id,
            user_id,
            request.object_key,
        )
        
        return _job_to_response(job)
        
    except Exception as e:
        logger.error("Failed to create job: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create transcription job",
        )


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_transcription_job(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    user_id = current_user.id
    """
    Get a transcription job status and results.
    
    Poll this endpoint until status is DONE or FAILED.
    Recommended polling interval: 2-5 seconds.
    """
    job_repo = _get_job_repo()
    
    try:
        job = job_repo.get_job_by_id(
            job_id=UUID(job_id),
            user_id=UUID(user_id),
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format",
        )
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    
    return _job_to_response(job)


@router.get("/jobs", response_model=JobListResponse)
async def list_transcription_jobs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
):
    user_id = current_user.id
    """
    List transcription jobs for the current user.
    
    Jobs are ordered by creation date (newest first).
    """
    job_repo = _get_job_repo()
    
    jobs = job_repo.get_jobs_by_user(
        user_id=UUID(user_id),
        limit=limit,
        offset=offset,
    )
    
    return JobListResponse(
        jobs=[_job_to_response(job) for job in jobs],
        total=len(jobs),  # TODO: Get actual total count
        limit=limit,
        offset=offset,
    )


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_transcription_job(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    user_id = current_user.id
    """
    Cancel a queued transcription job.
    
    Only QUEUED jobs can be cancelled. RUNNING jobs will complete.
    """
    job_repo = _get_job_repo()
    
    try:
        cancelled = job_repo.cancel_job(
            job_id=UUID(job_id),
            user_id=UUID(user_id),
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format",
        )
    
    if not cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job cannot be cancelled (not found or already processing)",
        )
    
    logger.info("Job cancelled: id=%s, user=%s", job_id, user_id)


@router.get("/quota", response_model=QuotaResponse)
async def get_quota_status(
    current_user: CurrentUser = Depends(get_current_user),
):
    user_id = current_user.id
    """
    Get current quota status for the user.
    """
    quota_service = _get_quota_service()
    
    usage = quota_service.get_usage(UUID(user_id))
    remaining = quota_service.get_remaining_minutes(UUID(user_id))
    
    return QuotaResponse(
        minutes_used=usage.minutes_used,
        minutes_remaining=remaining,
        daily_limit=quota_service.daily_limit,
        jobs_count=usage.jobs_count,
    )
