from __future__ import annotations


class TranscriptionError(Exception):
    pass


class QuotaExceededError(TranscriptionError):
    def __init__(self, message: str = "Daily quota exceeded", minutes_remaining: int = 0):
        super().__init__(message)
        self.minutes_remaining = minutes_remaining


class JobNotFoundError(TranscriptionError):
    def __init__(self, job_id: str):
        super().__init__(f"Job not found: {job_id}")
        self.job_id = job_id


class JobLockError(TranscriptionError):
    pass


class StorageError(TranscriptionError):
    pass


class StorageDownloadError(StorageError):
    def __init__(self, object_key: str, reason: str = "Download failed"):
        super().__init__(f"Failed to download {object_key}: {reason}")
        self.object_key = object_key
        self.reason = reason


class StorageTimeoutError(StorageError):
    def __init__(self, object_key: str, timeout_seconds: int):
        super().__init__(f"Timeout downloading {object_key} after {timeout_seconds}s")
        self.object_key = object_key
        self.timeout_seconds = timeout_seconds


class TranscriptionProcessingError(TranscriptionError):
    def __init__(self, message: str, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


class TranscriptionTimeoutError(TranscriptionProcessingError):
    def __init__(self, timeout_seconds: int):
        super().__init__(f"Transcription timed out after {timeout_seconds}s", retryable=True)
        self.timeout_seconds = timeout_seconds


class InvalidMediaError(TranscriptionError):
    def __init__(self, message: str = "Invalid or unsupported media file"):
        super().__init__(message)


class InvalidObjectKeyError(TranscriptionError):
    def __init__(self, object_key: str, reason: str = "Invalid object key"):
        super().__init__(f"{reason}: {object_key}")
        self.object_key = object_key
        self.reason = reason


class JobRepositoryError(TranscriptionError):
    def __init__(self, operation: str, reason: str):
        super().__init__(f"Job repository error during {operation}: {reason}")
        self.operation = operation
        self.reason = reason


class WorkerConfigurationError(TranscriptionError):
    def __init__(self, errors: list[str]):
        super().__init__(f"Worker configuration errors: {', '.join(errors)}")
        self.errors = errors


class TempFileCleanupError(TranscriptionError):
    def __init__(self, file_path: str, reason: str):
        super().__init__(f"Failed to cleanup temp file {file_path}: {reason}")
        self.file_path = file_path
        self.reason = reason
