# src/app/domain/errors.py
"""
Domain-specific exceptions for the transcription system.
"""
from __future__ import annotations


class TranscriptionError(Exception):
    """Base exception for transcription-related errors."""
    pass


class QuotaExceededError(TranscriptionError):
    """Raised when user has exceeded their daily quota."""
    def __init__(self, message: str = "Daily quota exceeded", minutes_remaining: int = 0):
        super().__init__(message)
        self.minutes_remaining = minutes_remaining


class JobNotFoundError(TranscriptionError):
    """Raised when a job is not found."""
    def __init__(self, job_id: str):
        super().__init__(f"Job not found: {job_id}")
        self.job_id = job_id


class JobLockError(TranscriptionError):
    """Raised when there's an issue with job locking."""
    pass


class StorageError(TranscriptionError):
    """Raised when there's an issue with storage operations."""
    pass


class TranscriptionProcessingError(TranscriptionError):
    """Raised when transcription processing fails."""
    def __init__(self, message: str, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


class InvalidMediaError(TranscriptionError):
    """Raised when the media file is invalid or unsupported."""
    def __init__(self, message: str = "Invalid or unsupported media file"):
        super().__init__(message)
