# src/app/domain/models.py
"""
Domain models for the transcription job queue system.
These are pure data structures with no infrastructure dependencies.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID


class JobStatus(str, Enum):
    """Status enum for transcription jobs."""
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass
class TranscriptionSegment:
    """A segment of transcribed audio with timing information."""
    start: float  # seconds
    end: float    # seconds
    text: str


@dataclass
class TranscriptionResult:
    """Result of a transcription operation."""
    text: str
    segments: list[TranscriptionSegment]
    language: str
    duration_sec: float
    model_version: str


@dataclass
class TranscriptionJob:
    """
    Represents a transcription job in the queue.
    This is the core domain model for async transcription processing.
    """
    id: UUID
    user_id: UUID
    object_key: str
    status: JobStatus
    
    # Optional recipe association
    recipe_id: Optional[UUID] = None
    
    # Queue management
    priority: int = 0
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    
    # Retry handling
    attempt_count: int = 0
    max_attempts: int = 3
    next_attempt_at: Optional[datetime] = None
    error_message: Optional[str] = None
    
    # Timestamps
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    
    # Results (populated when DONE)
    duration_sec: Optional[int] = None
    language: Optional[str] = None
    transcript_text: Optional[str] = None
    segments_json: Optional[list[dict[str, Any]]] = None
    model_version: Optional[str] = None
    
    @property
    def is_complete(self) -> bool:
        """Check if job has finished processing (successfully or not)."""
        return self.status in (JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELLED)
    
    @property
    def can_retry(self) -> bool:
        """Check if job can be retried."""
        return self.attempt_count < self.max_attempts


@dataclass
class UsageDaily:
    """Daily usage tracking for quota management."""
    user_id: UUID
    date: str  # YYYY-MM-DD format
    minutes_used: int = 0
    jobs_count: int = 0
    updated_at: Optional[datetime] = None


@dataclass
class SignedUploadResponse:
    """Response from signed upload URL generation."""
    object_key: str
    upload_url: str
    expires_at: datetime


@dataclass
class QuotaCheck:
    """Result of a quota check operation."""
    allowed: bool
    minutes_remaining: int
    daily_limit: int
    reason: Optional[str] = None
