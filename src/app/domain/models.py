from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from uuid import UUID


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass
class TranscriptionSegment:
    start: float
    end: float
    text: str


@dataclass
class TranscriptionResult:
    text: str
    segments: list[TranscriptionSegment]
    language: str
    duration_sec: float
    model_version: str


@dataclass
class TranscriptionJob:
    id: UUID
    user_id: UUID
    object_key: str
    status: JobStatus
    recipe_id: UUID | None = None
    priority: int = 0
    locked_at: datetime | None = None
    locked_by: str | None = None
    attempt_count: int = 0
    max_attempts: int = 3
    next_attempt_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_sec: int | None = None
    language: str | None = None
    transcript_text: str | None = None
    segments_json: list[dict[str, float | str]] | None = None
    model_version: str | None = None

    @property
    def is_complete(self) -> bool:
        return self.status in (JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELLED)

    @property
    def can_retry(self) -> bool:
        return self.attempt_count < self.max_attempts


@dataclass
class UsageDaily:
    user_id: UUID
    date: str
    minutes_used: int = 0
    jobs_count: int = 0
    updated_at: datetime | None = None


@dataclass
class SignedUploadResponse:
    object_key: str
    upload_url: str
    expires_at: datetime


@dataclass
class QuotaCheck:
    allowed: bool
    minutes_remaining: int
    daily_limit: int
    reason: str | None = None
