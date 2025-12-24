from __future__ import annotations

import pytest

from src.app.domain.errors import (
    TranscriptionError,
    QuotaExceededError,
    JobNotFoundError,
    JobLockError,
    StorageError,
    StorageDownloadError,
    StorageTimeoutError,
    TranscriptionProcessingError,
    TranscriptionTimeoutError,
    InvalidMediaError,
    InvalidObjectKeyError,
    JobRepositoryError,
    WorkerConfigurationError,
    TempFileCleanupError,
)


class TestTranscriptionError:
    def test_base_exception(self) -> None:
        error = TranscriptionError("Base error")
        assert str(error) == "Base error"
        assert isinstance(error, Exception)


class TestQuotaExceededError:
    def test_default_message(self) -> None:
        error = QuotaExceededError()
        assert str(error) == "Daily quota exceeded"
        assert error.minutes_remaining == 0

    def test_custom_message_and_minutes(self) -> None:
        error = QuotaExceededError("Custom message", minutes_remaining=15)
        assert str(error) == "Custom message"
        assert error.minutes_remaining == 15


class TestJobNotFoundError:
    def test_includes_job_id(self) -> None:
        error = JobNotFoundError("abc-123")
        assert "abc-123" in str(error)
        assert error.job_id == "abc-123"


class TestStorageDownloadError:
    def test_includes_object_key_and_reason(self) -> None:
        error = StorageDownloadError("users/test/file.mp3", "Not found")
        assert "users/test/file.mp3" in str(error)
        assert "Not found" in str(error)
        assert error.object_key == "users/test/file.mp3"
        assert error.reason == "Not found"


class TestStorageTimeoutError:
    def test_includes_timeout_info(self) -> None:
        error = StorageTimeoutError("users/test/file.mp3", 30)
        assert "30" in str(error)
        assert error.object_key == "users/test/file.mp3"
        assert error.timeout_seconds == 30


class TestTranscriptionProcessingError:
    def test_retryable_default_true(self) -> None:
        error = TranscriptionProcessingError("Processing failed")
        assert error.retryable is True

    def test_not_retryable(self) -> None:
        error = TranscriptionProcessingError("Invalid format", retryable=False)
        assert error.retryable is False


class TestTranscriptionTimeoutError:
    def test_timeout_error(self) -> None:
        error = TranscriptionTimeoutError(1800)
        assert "1800" in str(error)
        assert error.timeout_seconds == 1800
        assert error.retryable is True


class TestInvalidObjectKeyError:
    def test_includes_key_and_reason(self) -> None:
        error = InvalidObjectKeyError("../../../etc/passwd", "Path traversal detected")
        assert "../../../etc/passwd" in str(error)
        assert error.reason == "Path traversal detected"


class TestJobRepositoryError:
    def test_includes_operation_and_reason(self) -> None:
        error = JobRepositoryError("enqueue", "Connection refused")
        assert "enqueue" in str(error)
        assert "Connection refused" in str(error)
        assert error.operation == "enqueue"
        assert error.reason == "Connection refused"


class TestWorkerConfigurationError:
    def test_includes_all_errors(self) -> None:
        errors = ["Missing SUPABASE_URL", "Missing R2_BUCKET"]
        error = WorkerConfigurationError(errors)
        assert "Missing SUPABASE_URL" in str(error)
        assert "Missing R2_BUCKET" in str(error)
        assert error.errors == errors


class TestTempFileCleanupError:
    def test_includes_path_and_reason(self) -> None:
        error = TempFileCleanupError("/tmp/file.mp3", "Permission denied")
        assert "/tmp/file.mp3" in str(error)
        assert "Permission denied" in str(error)


class TestExceptionHierarchy:
    def test_all_domain_errors_inherit_from_transcription_error(self) -> None:
        assert issubclass(QuotaExceededError, TranscriptionError)
        assert issubclass(JobNotFoundError, TranscriptionError)
        assert issubclass(JobLockError, TranscriptionError)
        assert issubclass(StorageError, TranscriptionError)
        assert issubclass(StorageDownloadError, StorageError)
        assert issubclass(StorageTimeoutError, StorageError)
        assert issubclass(TranscriptionProcessingError, TranscriptionError)
        assert issubclass(TranscriptionTimeoutError, TranscriptionProcessingError)
        assert issubclass(InvalidMediaError, TranscriptionError)
        assert issubclass(InvalidObjectKeyError, TranscriptionError)
        assert issubclass(JobRepositoryError, TranscriptionError)
        assert issubclass(WorkerConfigurationError, TranscriptionError)
        assert issubclass(TempFileCleanupError, TranscriptionError)
