from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from src.app.domain.models import TranscriptionJob, UsageDaily, QuotaCheck


class JobQueueRepository(ABC):
    @abstractmethod
    def enqueue_transcription_job(
        self,
        user_id: UUID,
        object_key: str,
        recipe_id: UUID | None = None,
        estimated_duration_sec: int = 0,
        priority: int = 0,
    ) -> TranscriptionJob:
        pass

    @abstractmethod
    def fetch_and_lock_next_job(
        self,
        worker_id: str,
        now_ts: datetime | None = None,
    ) -> TranscriptionJob | None:
        pass

    @abstractmethod
    def mark_running(
        self,
        job_id: UUID,
        worker_id: str,
        started_at: datetime | None = None,
        stage: str | None = None,
        progress: float | None = None,
        last_heartbeat_at: datetime | None = None,
    ) -> bool:
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
        pass

    @abstractmethod
    def mark_failed(
        self,
        job_id: UUID,
        error_message: str,
        retry_at: datetime | None = None,
        permanent: bool = False,
    ) -> bool:
        pass

    @abstractmethod
    def update_job_progress(
        self,
        job_id: UUID,
        stage: str | None = None,
        progress: float | None = None,
        last_heartbeat_at: datetime | None = None,
    ) -> bool:
        pass

    @abstractmethod
    def release_stale_locks(
        self,
        lock_ttl_minutes: int = 30,
    ) -> int:
        pass

    @abstractmethod
    def get_job_by_id(
        self,
        job_id: UUID,
        user_id: UUID | None = None,
    ) -> TranscriptionJob | None:
        pass

    @abstractmethod
    def get_jobs_by_user(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> list[TranscriptionJob]:
        pass

    @abstractmethod
    def cancel_job(
        self,
        job_id: UUID,
        user_id: UUID,
    ) -> bool:
        pass


class QuotaRepository(ABC):
    @abstractmethod
    def check_and_reserve_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        daily_limit: int = 60,
    ) -> QuotaCheck:
        pass

    @abstractmethod
    def confirm_actual_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        actual_minutes: int,
    ) -> None:
        pass

    @abstractmethod
    def get_daily_usage(
        self,
        user_id: UUID,
    ) -> UsageDaily:
        pass
