# src/app/infra/db/base.py
"""
Abstract base class for job queue repository.
This interface allows easy swapping between different queue backends.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional
from uuid import UUID

from src.app.domain.models import TranscriptionJob, UsageDaily, QuotaCheck


class JobQueueRepository(ABC):
    """
    Abstract interface for job queue operations.
    
    Implementations:
    - SupabaseJobQueueRepository: Postgres-based queue using Supabase
    - Future: RabbitMQJobQueueRepository, RedisJobQueueRepository
    """
    
    @abstractmethod
    def enqueue_transcription_job(
        self,
        user_id: UUID,
        object_key: str,
        recipe_id: Optional[UUID] = None,
        estimated_duration_sec: int = 0,
        priority: int = 0,
    ) -> TranscriptionJob:
        """
        Create a new transcription job in QUEUED status.
        
        Args:
            user_id: Owner of the job
            object_key: Storage key for the media file
            recipe_id: Optional associated recipe
            estimated_duration_sec: Estimated audio duration for quota
            priority: Job priority (higher = processed first)
            
        Returns:
            The created TranscriptionJob
        """
        pass
    
    @abstractmethod
    def fetch_and_lock_next_job(
        self,
        worker_id: str,
        now_ts: Optional[datetime] = None,
    ) -> Optional[TranscriptionJob]:
        """
        Atomically fetch and lock the next available job.
        Uses FOR UPDATE SKIP LOCKED pattern for safe concurrency.
        
        Args:
            worker_id: Identifier for this worker instance
            now_ts: Current timestamp (for testing)
            
        Returns:
            The locked job, or None if no jobs available
        """
        pass
    
    @abstractmethod
    def mark_running(
        self,
        job_id: UUID,
        worker_id: str,
        started_at: Optional[datetime] = None,
    ) -> bool:
        """
        Mark a job as RUNNING.
        
        Args:
            job_id: The job to update
            worker_id: The worker processing this job
            started_at: When processing started
            
        Returns:
            True if successful
        """
        pass
    
    @abstractmethod
    def mark_done(
        self,
        job_id: UUID,
        transcript_text: str,
        segments_json: list[dict],
        language: str,
        duration_sec: int,
        model_version: str,
    ) -> bool:
        """
        Mark a job as DONE with results.
        
        Args:
            job_id: The job to update
            transcript_text: Full transcription text
            segments_json: Segments with timing info
            language: Detected/specified language
            duration_sec: Actual audio duration
            model_version: Model used for transcription
            
        Returns:
            True if successful
        """
        pass
    
    @abstractmethod
    def mark_failed(
        self,
        job_id: UUID,
        error_message: str,
        retry_at: Optional[datetime] = None,
        permanent: bool = False,
    ) -> bool:
        """
        Mark a job as FAILED, potentially scheduling a retry.
        
        Args:
            job_id: The job to update
            error_message: Error description
            retry_at: When to retry (None = no retry)
            permanent: If True, mark as permanently failed
            
        Returns:
            True if successful
        """
        pass
    
    @abstractmethod
    def release_stale_locks(
        self,
        lock_ttl_minutes: int = 30,
    ) -> int:
        """
        Release locks on jobs that have been locked too long (crashed workers).
        Requeues them for retry.
        
        Args:
            lock_ttl_minutes: How long a lock can be held before considered stale
            
        Returns:
            Number of jobs released
        """
        pass
    
    @abstractmethod
    def get_job_by_id(
        self,
        job_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> Optional[TranscriptionJob]:
        """
        Get a job by its ID, optionally filtering by user.
        
        Args:
            job_id: The job ID
            user_id: If provided, only return if owned by this user
            
        Returns:
            The job, or None if not found
        """
        pass
    
    @abstractmethod
    def get_jobs_by_user(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list[TranscriptionJob]:
        """
        Get jobs for a user, ordered by creation date descending.
        
        Args:
            user_id: The user ID
            limit: Max jobs to return
            offset: Pagination offset
            
        Returns:
            List of jobs
        """
        pass
    
    @abstractmethod
    def cancel_job(
        self,
        job_id: UUID,
        user_id: UUID,
    ) -> bool:
        """
        Cancel a job if it's still QUEUED.
        
        Args:
            job_id: The job to cancel
            user_id: Must be the owner
            
        Returns:
            True if cancelled successfully
        """
        pass


class QuotaRepository(ABC):
    """
    Abstract interface for quota/usage tracking.
    """
    
    @abstractmethod
    def check_and_reserve_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        daily_limit: int = 60,
    ) -> QuotaCheck:
        """
        Check if user has quota and reserve minutes.
        
        Args:
            user_id: The user to check
            estimated_minutes: Minutes to reserve
            daily_limit: Max minutes per day
            
        Returns:
            QuotaCheck with result
        """
        pass
    
    @abstractmethod
    def confirm_actual_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        actual_minutes: int,
    ) -> None:
        """
        Reconcile estimated vs actual usage after processing.
        
        Args:
            user_id: The user
            estimated_minutes: Originally reserved
            actual_minutes: Actually used
        """
        pass
    
    @abstractmethod
    def get_daily_usage(
        self,
        user_id: UUID,
    ) -> UsageDaily:
        """
        Get today's usage for a user.
        
        Args:
            user_id: The user
            
        Returns:
            UsageDaily record
        """
        pass
