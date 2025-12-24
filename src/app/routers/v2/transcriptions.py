from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from src.app.deps import get_current_user, CurrentUser
from src.app.domain.errors import (
    QuotaExceededError,
    JobNotFoundError,
    StorageError,
    JobRepositoryError,
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


class CreateJobRequest(BaseModel):
    object_key: str = Field(...)
    recipe_id: str | None = Field(None)
    estimated_duration_sec: int = Field(default=300, ge=1, le=7200)
    priority: int = Field(default=0, ge=0, le=10)


class TranscriptionSegment(BaseModel):
    start: float = Field(...)
    end: float = Field(...)
    text: str = Field(...)


class JobResponse(BaseModel):
    id: str = Field(...)
    status: str = Field(...)
    object_key: str = Field(...)
    recipe_id: str | None = Field(None)
    created_at: datetime | None = Field(None)
    started_at: datetime | None = Field(None)
    finished_at: datetime | None = Field(None)
    attempt_count: int = Field(default=0)
    error_message: str | None = Field(None)
    transcript_text: str | None = Field(None)
    segments: list[TranscriptionSegment] | None = Field(None)
    language: str | None = Field(None)
    duration_sec: int | None = Field(None)
    model_version: str | None = Field(None)


class JobListResponse(BaseModel):
    jobs: list[JobResponse]
    total: int
    limit: int
    offset: int


class QuotaResponse(BaseModel):
    minutes_used: int = Field(...)
    minutes_remaining: int = Field(...)
    daily_limit: int = Field(...)
    jobs_count: int = Field(...)


def _get_job_repo() -> SupabaseJobQueueRepository:
    return SupabaseJobQueueRepository()


def _get_quota_service() -> QuotaService:
    return QuotaService()


def _get_storage() -> R2StorageProvider | None:
    try:
        return R2StorageProvider()
    except StorageError:
        return None


def _job_to_response(job) -> JobResponse:
    segments = None
    if job.segments_json:
        segments = [
            TranscriptionSegment(
                start=float(seg.get("start", 0)),
                end=float(seg.get("end", 0)),
                text=str(seg.get("text", "")),
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


@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_transcription_job(
    request: CreateJobRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> JobResponse:
    user_id = current_user.id

    if not request.object_key.startswith(f"users/{user_id}/"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Object key does not belong to this user",
        )

    storage = _get_storage()
    if storage:
        try:
            if not storage.object_exists(request.object_key):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File not found in storage. Please upload first.",
                )
        except StorageError as storage_error:
            logger.warning("Could not verify file existence: %s", storage_error)

    quota_service = _get_quota_service()
    estimated_minutes = max(1, request.estimated_duration_sec // 60)

    try:
        quota_service.reserve_minutes(
            user_id=UUID(user_id),
            estimated_minutes=estimated_minutes,
        )
    except QuotaExceededError as quota_error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily quota exceeded. Remaining: {quota_error.minutes_remaining} minutes.",
        )

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

    except JobRepositoryError as repo_error:
        logger.error("Failed to create job: %s", repo_error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create transcription job",
        )


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_transcription_job(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> JobResponse:
    user_id = current_user.id
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
) -> JobListResponse:
    user_id = current_user.id
    job_repo = _get_job_repo()

    jobs = job_repo.get_jobs_by_user(
        user_id=UUID(user_id),
        limit=limit,
        offset=offset,
    )

    return JobListResponse(
        jobs=[_job_to_response(job) for job in jobs],
        total=len(jobs),
        limit=limit,
        offset=offset,
    )


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_transcription_job(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    user_id = current_user.id
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
) -> QuotaResponse:
    user_id = current_user.id
    quota_service = _get_quota_service()

    usage = quota_service.get_usage(UUID(user_id))
    remaining = quota_service.get_remaining_minutes(UUID(user_id))

    return QuotaResponse(
        minutes_used=usage.minutes_used,
        minutes_remaining=remaining,
        daily_limit=quota_service.daily_limit,
        jobs_count=usage.jobs_count,
    )
