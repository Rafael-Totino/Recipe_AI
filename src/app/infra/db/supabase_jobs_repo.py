# src/app/infra/db/supabase_jobs_repo.py
"""
Supabase/Postgres implementation of the job queue repository.
Uses row-level locking (FOR UPDATE SKIP LOCKED) for safe concurrent access.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from uuid import UUID, uuid4

from supabase import Client, create_client

from src.app.domain.errors import JobNotFoundError, JobLockError
from src.app.domain.models import JobStatus, TranscriptionJob, UsageDaily, QuotaCheck
from src.app.infra.db.base import JobQueueRepository, QuotaRepository

logger = logging.getLogger(__name__)


def _parse_datetime(value: Any) -> Optional[datetime]:
    """Parse datetime from Supabase response."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        # Handle ISO format with or without timezone
        try:
            if value.endswith("Z"):
                value = value[:-1] + "+00:00"
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


def _row_to_job(row: Dict[str, Any]) -> TranscriptionJob:
    """Convert a database row to a TranscriptionJob."""
    return TranscriptionJob(
        id=UUID(row["id"]),
        user_id=UUID(row["user_id"]),
        object_key=row["object_key"],
        status=JobStatus(row["status"]),
        recipe_id=UUID(row["recipe_id"]) if row.get("recipe_id") else None,
        priority=row.get("priority", 0),
        locked_at=_parse_datetime(row.get("locked_at")),
        locked_by=row.get("locked_by"),
        attempt_count=row.get("attempt_count", 0),
        max_attempts=row.get("max_attempts", 3),
        next_attempt_at=_parse_datetime(row.get("next_attempt_at")),
        error_message=row.get("error_message"),
        created_at=_parse_datetime(row.get("created_at")),
        started_at=_parse_datetime(row.get("started_at")),
        finished_at=_parse_datetime(row.get("finished_at")),
        duration_sec=row.get("duration_sec"),
        language=row.get("language"),
        transcript_text=row.get("transcript_text"),
        segments_json=row.get("segments_json"),
        model_version=row.get("model_version"),
    )


class SupabaseJobQueueRepository(JobQueueRepository):
    """
    Postgres-based job queue using Supabase.
    
    Uses FOR UPDATE SKIP LOCKED for safe concurrent job fetching.
    This pattern ensures:
    - Only one worker can process a job at a time
    - Workers don't block waiting for locked rows
    - Crashed workers' jobs can be recovered via stale lock detection
    """
    
    TABLE_NAME = "transcription_jobs"
    
    def __init__(self, client: Optional[Client] = None):
        if client is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if not url or not key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
            self._client = create_client(url, key)
        else:
            self._client = client
        
        logger.info("SupabaseJobQueueRepository initialized")
    
    def enqueue_transcription_job(
        self,
        user_id: UUID,
        object_key: str,
        recipe_id: Optional[UUID] = None,
        estimated_duration_sec: int = 0,
        priority: int = 0,
    ) -> TranscriptionJob:
        """Create a new job in QUEUED status."""
        job_id = uuid4()
        now = datetime.now(timezone.utc)
        
        data = {
            "id": str(job_id),
            "user_id": str(user_id),
            "object_key": object_key,
            "status": JobStatus.QUEUED.value,
            "priority": priority,
            "attempt_count": 0,
            "max_attempts": 3,
            "created_at": now.isoformat(),
            "estimated_duration_sec": estimated_duration_sec,
        }
        
        if recipe_id:
            data["recipe_id"] = str(recipe_id)
        
        try:
            result = (
                self._client.table(self.TABLE_NAME)
                .insert(data)
                .execute()
            )
            
            if not result.data:
                raise JobLockError("Failed to create job")
            
            job = _row_to_job(result.data[0])
            
            logger.info(
                "Created transcription job: id=%s, user=%s, object_key=%s",
                job.id,
                user_id,
                object_key,
            )
            
            return job
            
        except Exception as e:
            logger.error("Failed to enqueue job: %s", e)
            raise
    
    def fetch_and_lock_next_job(
        self,
        worker_id: str,
        now_ts: Optional[datetime] = None,
    ) -> Optional[TranscriptionJob]:
        """
        Atomically fetch and lock the next available job.
        
        Uses a raw SQL query with FOR UPDATE SKIP LOCKED for safe concurrency.
        This is executed via a Supabase RPC function.
        """
        now = now_ts or datetime.now(timezone.utc)
        
        try:
            # Call the RPC function that handles locking atomically
            result = self._client.rpc(
                "fetch_and_lock_transcription_job",
                {
                    "p_worker_id": worker_id,
                    "p_now": now.isoformat(),
                }
            ).execute()
            
            if not result.data or len(result.data) == 0:
                logger.debug("No jobs available for worker %s", worker_id)
                return None
            
            job = _row_to_job(result.data[0])
            
            logger.info(
                "Locked job: id=%s, worker=%s, attempt=%d",
                job.id,
                worker_id,
                job.attempt_count,
            )
            
            return job
            
        except Exception as e:
            logger.error("Failed to fetch and lock job: %s", e)
            return None
    
    def mark_running(
        self,
        job_id: UUID,
        worker_id: str,
        started_at: Optional[datetime] = None,
    ) -> bool:
        """Mark a job as RUNNING."""
        now = started_at or datetime.now(timezone.utc)
        
        try:
            result = (
                self._client.table(self.TABLE_NAME)
                .update({
                    "status": JobStatus.RUNNING.value,
                    "locked_by": worker_id,
                    "locked_at": now.isoformat(),
                    "started_at": now.isoformat(),
                    "attempt_count": self._client.table(self.TABLE_NAME)
                        .select("attempt_count")
                        .eq("id", str(job_id))
                        .single()
                        .execute()
                        .data.get("attempt_count", 0) + 1,
                })
                .eq("id", str(job_id))
                .execute()
            )
            
            if result.data:
                logger.info("Job marked as RUNNING: id=%s, worker=%s", job_id, worker_id)
                return True
            return False
            
        except Exception as e:
            logger.error("Failed to mark job as running: %s", e)
            return False
    
    def mark_done(
        self,
        job_id: UUID,
        transcript_text: str,
        segments_json: list[dict],
        language: str,
        duration_sec: int,
        model_version: str,
    ) -> bool:
        """Mark a job as DONE with results."""
        now = datetime.now(timezone.utc)
        
        try:
            result = (
                self._client.table(self.TABLE_NAME)
                .update({
                    "status": JobStatus.DONE.value,
                    "finished_at": now.isoformat(),
                    "transcript_text": transcript_text,
                    "segments_json": segments_json,
                    "language": language,
                    "duration_sec": duration_sec,
                    "model_version": model_version,
                    "locked_at": None,
                    "locked_by": None,
                    "error_message": None,
                })
                .eq("id", str(job_id))
                .execute()
            )
            
            if result.data:
                logger.info(
                    "Job completed: id=%s, duration=%ds, language=%s",
                    job_id,
                    duration_sec,
                    language,
                )
                return True
            return False
            
        except Exception as e:
            logger.error("Failed to mark job as done: %s", e)
            return False
    
    def mark_failed(
        self,
        job_id: UUID,
        error_message: str,
        retry_at: Optional[datetime] = None,
        permanent: bool = False,
    ) -> bool:
        """Mark a job as FAILED, potentially scheduling a retry."""
        now = datetime.now(timezone.utc)
        
        # Get current attempt count
        try:
            job_result = (
                self._client.table(self.TABLE_NAME)
                .select("attempt_count, max_attempts")
                .eq("id", str(job_id))
                .single()
                .execute()
            )
            
            if not job_result.data:
                return False
            
            attempt_count = job_result.data.get("attempt_count", 0)
            max_attempts = job_result.data.get("max_attempts", 3)
            
            # Determine if we should retry
            should_retry = not permanent and attempt_count < max_attempts
            
            if should_retry and retry_at is None:
                # Exponential backoff: 1min, 2min, 4min, etc.
                backoff_minutes = 2 ** attempt_count
                retry_at = now + timedelta(minutes=backoff_minutes)
            
            update_data = {
                "error_message": error_message,
                "locked_at": None,
                "locked_by": None,
            }
            
            if should_retry:
                update_data["status"] = JobStatus.QUEUED.value
                update_data["next_attempt_at"] = retry_at.isoformat() if retry_at else None
                logger.warning(
                    "Job failed, will retry: id=%s, attempt=%d/%d, next_retry=%s, error=%s",
                    job_id,
                    attempt_count,
                    max_attempts,
                    retry_at,
                    error_message,
                )
            else:
                update_data["status"] = JobStatus.FAILED.value
                update_data["finished_at"] = now.isoformat()
                logger.error(
                    "Job permanently failed: id=%s, attempts=%d, error=%s",
                    job_id,
                    attempt_count,
                    error_message,
                )
            
            result = (
                self._client.table(self.TABLE_NAME)
                .update(update_data)
                .eq("id", str(job_id))
                .execute()
            )
            
            return bool(result.data)
            
        except Exception as e:
            logger.error("Failed to mark job as failed: %s", e)
            return False
    
    def release_stale_locks(
        self,
        lock_ttl_minutes: int = 30,
    ) -> int:
        """Release locks on jobs that have been locked too long."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=lock_ttl_minutes)
        
        try:
            # Find stale locked jobs
            result = (
                self._client.table(self.TABLE_NAME)
                .select("id, attempt_count, max_attempts")
                .eq("status", JobStatus.RUNNING.value)
                .lt("locked_at", cutoff.isoformat())
                .execute()
            )
            
            if not result.data:
                return 0
            
            released_count = 0
            
            for row in result.data:
                job_id = row["id"]
                attempt_count = row.get("attempt_count", 0)
                max_attempts = row.get("max_attempts", 3)
                
                # Determine new status based on attempts
                if attempt_count >= max_attempts:
                    new_status = JobStatus.FAILED.value
                    update_data = {
                        "status": new_status,
                        "locked_at": None,
                        "locked_by": None,
                        "error_message": "Job timed out after max attempts",
                        "finished_at": datetime.now(timezone.utc).isoformat(),
                    }
                else:
                    new_status = JobStatus.QUEUED.value
                    # Backoff for retry
                    retry_at = datetime.now(timezone.utc) + timedelta(minutes=2 ** attempt_count)
                    update_data = {
                        "status": new_status,
                        "locked_at": None,
                        "locked_by": None,
                        "next_attempt_at": retry_at.isoformat(),
                        "error_message": "Lock timed out, requeued for retry",
                    }
                
                self._client.table(self.TABLE_NAME).update(update_data).eq("id", job_id).execute()
                released_count += 1
                
                logger.warning(
                    "Released stale lock: job_id=%s, new_status=%s",
                    job_id,
                    new_status,
                )
            
            if released_count > 0:
                logger.info("Released %d stale locks", released_count)
            
            return released_count
            
        except Exception as e:
            logger.error("Failed to release stale locks: %s", e)
            return 0
    
    def get_job_by_id(
        self,
        job_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> Optional[TranscriptionJob]:
        """Get a job by its ID."""
        try:
            query = self._client.table(self.TABLE_NAME).select("*").eq("id", str(job_id))
            
            if user_id:
                query = query.eq("user_id", str(user_id))
            
            result = query.single().execute()
            
            if not result.data:
                return None
            
            return _row_to_job(result.data)
            
        except Exception as e:
            logger.error("Failed to get job by id: %s", e)
            return None
    
    def get_jobs_by_user(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list[TranscriptionJob]:
        """Get jobs for a user."""
        try:
            result = (
                self._client.table(self.TABLE_NAME)
                .select("*")
                .eq("user_id", str(user_id))
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            
            return [_row_to_job(row) for row in (result.data or [])]
            
        except Exception as e:
            logger.error("Failed to get jobs for user: %s", e)
            return []
    
    def cancel_job(
        self,
        job_id: UUID,
        user_id: UUID,
    ) -> bool:
        """Cancel a job if it's still QUEUED."""
        try:
            result = (
                self._client.table(self.TABLE_NAME)
                .update({
                    "status": JobStatus.CANCELLED.value,
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", str(job_id))
                .eq("user_id", str(user_id))
                .eq("status", JobStatus.QUEUED.value)
                .execute()
            )
            
            if result.data:
                logger.info("Job cancelled: id=%s, user=%s", job_id, user_id)
                return True
            return False
            
        except Exception as e:
            logger.error("Failed to cancel job: %s", e)
            return False


class SupabaseQuotaRepository(QuotaRepository):
    """
    Supabase/Postgres implementation of quota tracking.
    Uses the usage_daily table for per-user daily limits.
    """
    
    TABLE_NAME = "usage_daily"
    
    def __init__(self, client: Optional[Client] = None):
        if client is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if not url or not key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
            self._client = create_client(url, key)
        else:
            self._client = client
    
    def check_and_reserve_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        daily_limit: int = 60,
    ) -> QuotaCheck:
        """Check if user has quota and reserve minutes atomically."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        try:
            # Call RPC function for atomic check-and-reserve
            result = self._client.rpc(
                "check_and_reserve_quota",
                {
                    "p_user_id": str(user_id),
                    "p_date": today,
                    "p_minutes_to_reserve": estimated_minutes,
                    "p_daily_limit": daily_limit,
                }
            ).execute()
            
            if result.data:
                data = result.data[0] if isinstance(result.data, list) else result.data
                return QuotaCheck(
                    allowed=data.get("allowed", False),
                    minutes_remaining=data.get("minutes_remaining", 0),
                    daily_limit=daily_limit,
                    reason=data.get("reason"),
                )
            
            # Fallback: assume allowed if RPC fails
            logger.warning("Quota check RPC failed, allowing by default")
            return QuotaCheck(
                allowed=True,
                minutes_remaining=daily_limit,
                daily_limit=daily_limit,
            )
            
        except Exception as e:
            logger.error("Failed to check quota: %s", e)
            # Allow on error to avoid blocking users
            return QuotaCheck(
                allowed=True,
                minutes_remaining=daily_limit,
                daily_limit=daily_limit,
                reason="Quota check failed, allowing by default",
            )
    
    def confirm_actual_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        actual_minutes: int,
    ) -> None:
        """Reconcile estimated vs actual usage."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        diff = actual_minutes - estimated_minutes
        
        if diff == 0:
            return
        
        try:
            self._client.rpc(
                "adjust_quota_usage",
                {
                    "p_user_id": str(user_id),
                    "p_date": today,
                    "p_minutes_delta": diff,
                }
            ).execute()
            
            logger.debug(
                "Adjusted quota: user=%s, estimated=%d, actual=%d, diff=%d",
                user_id,
                estimated_minutes,
                actual_minutes,
                diff,
            )
            
        except Exception as e:
            logger.error("Failed to adjust quota: %s", e)
    
    def get_daily_usage(
        self,
        user_id: UUID,
    ) -> UsageDaily:
        """Get today's usage for a user."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        try:
            result = (
                self._client.table(self.TABLE_NAME)
                .select("*")
                .eq("user_id", str(user_id))
                .eq("date", today)
                .single()
                .execute()
            )
            
            if result.data:
                return UsageDaily(
                    user_id=user_id,
                    date=today,
                    minutes_used=result.data.get("minutes_used", 0),
                    jobs_count=result.data.get("jobs_count", 0),
                    updated_at=_parse_datetime(result.data.get("updated_at")),
                )
            
            # No usage record yet
            return UsageDaily(
                user_id=user_id,
                date=today,
                minutes_used=0,
                jobs_count=0,
            )
            
        except Exception as e:
            logger.error("Failed to get daily usage: %s", e)
            return UsageDaily(
                user_id=user_id,
                date=today,
                minutes_used=0,
                jobs_count=0,
            )
