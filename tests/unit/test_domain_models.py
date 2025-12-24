from __future__ import annotations

import pytest
from datetime import datetime, timezone
from uuid import UUID, uuid4

from src.app.domain.models import (
    JobStatus,
    TranscriptionJob,
    TranscriptionSegment,
    TranscriptionResult,
    UsageDaily,
    QuotaCheck,
    SignedUploadResponse,
)


class TestJobStatus:
    def test_job_status_values(self) -> None:
        assert JobStatus.QUEUED.value == "QUEUED"
        assert JobStatus.RUNNING.value == "RUNNING"
        assert JobStatus.DONE.value == "DONE"
        assert JobStatus.FAILED.value == "FAILED"
        assert JobStatus.CANCELLED.value == "CANCELLED"

    def test_job_status_is_string_enum(self) -> None:
        assert isinstance(JobStatus.QUEUED, str)
        assert JobStatus.QUEUED == "QUEUED"


class TestTranscriptionSegment:
    def test_create_segment(self) -> None:
        segment = TranscriptionSegment(start=0.0, end=5.0, text="Hello world")

        assert segment.start == 0.0
        assert segment.end == 5.0
        assert segment.text == "Hello world"


class TestTranscriptionResult:
    def test_create_result(self) -> None:
        segments = [
            TranscriptionSegment(start=0.0, end=5.0, text="First segment"),
            TranscriptionSegment(start=5.0, end=10.0, text="Second segment"),
        ]

        result = TranscriptionResult(
            text="First segment Second segment",
            segments=segments,
            language="pt",
            duration_sec=10.0,
            model_version="medium",
        )

        assert result.text == "First segment Second segment"
        assert len(result.segments) == 2
        assert result.language == "pt"
        assert result.duration_sec == 10.0
        assert result.model_version == "medium"


class TestTranscriptionJob:
    def test_create_job_minimal(self) -> None:
        job_id = uuid4()
        user_id = uuid4()

        job = TranscriptionJob(
            id=job_id,
            user_id=user_id,
            object_key="users/test/media/file.mp3",
            status=JobStatus.QUEUED,
        )

        assert job.id == job_id
        assert job.user_id == user_id
        assert job.object_key == "users/test/media/file.mp3"
        assert job.status == JobStatus.QUEUED
        assert job.attempt_count == 0
        assert job.max_attempts == 3

    def test_is_complete_done(self) -> None:
        job = TranscriptionJob(
            id=uuid4(),
            user_id=uuid4(),
            object_key="test.mp3",
            status=JobStatus.DONE,
        )

        assert job.is_complete is True

    def test_is_complete_failed(self) -> None:
        job = TranscriptionJob(
            id=uuid4(),
            user_id=uuid4(),
            object_key="test.mp3",
            status=JobStatus.FAILED,
        )

        assert job.is_complete is True

    def test_is_complete_cancelled(self) -> None:
        job = TranscriptionJob(
            id=uuid4(),
            user_id=uuid4(),
            object_key="test.mp3",
            status=JobStatus.CANCELLED,
        )

        assert job.is_complete is True

    def test_is_complete_running(self) -> None:
        job = TranscriptionJob(
            id=uuid4(),
            user_id=uuid4(),
            object_key="test.mp3",
            status=JobStatus.RUNNING,
        )

        assert job.is_complete is False

    def test_is_complete_queued(self) -> None:
        job = TranscriptionJob(
            id=uuid4(),
            user_id=uuid4(),
            object_key="test.mp3",
            status=JobStatus.QUEUED,
        )

        assert job.is_complete is False

    def test_can_retry_when_attempts_remaining(self) -> None:
        job = TranscriptionJob(
            id=uuid4(),
            user_id=uuid4(),
            object_key="test.mp3",
            status=JobStatus.QUEUED,
            attempt_count=1,
            max_attempts=3,
        )

        assert job.can_retry is True

    def test_can_retry_when_max_reached(self) -> None:
        job = TranscriptionJob(
            id=uuid4(),
            user_id=uuid4(),
            object_key="test.mp3",
            status=JobStatus.FAILED,
            attempt_count=3,
            max_attempts=3,
        )

        assert job.can_retry is False


class TestUsageDaily:
    def test_create_usage_daily(self) -> None:
        user_id = uuid4()

        usage = UsageDaily(
            user_id=user_id,
            date="2024-01-15",
            minutes_used=30,
            jobs_count=5,
        )

        assert usage.user_id == user_id
        assert usage.date == "2024-01-15"
        assert usage.minutes_used == 30
        assert usage.jobs_count == 5


class TestQuotaCheck:
    def test_quota_check_allowed(self) -> None:
        check = QuotaCheck(
            allowed=True,
            minutes_remaining=30,
            daily_limit=60,
        )

        assert check.allowed is True
        assert check.minutes_remaining == 30
        assert check.daily_limit == 60
        assert check.reason is None

    def test_quota_check_denied(self) -> None:
        check = QuotaCheck(
            allowed=False,
            minutes_remaining=0,
            daily_limit=60,
            reason="Daily quota exceeded",
        )

        assert check.allowed is False
        assert check.minutes_remaining == 0
        assert check.reason == "Daily quota exceeded"


class TestSignedUploadResponse:
    def test_create_signed_upload_response(self) -> None:
        expires_at = datetime.now(timezone.utc)

        response = SignedUploadResponse(
            object_key="users/123/media/file.mp3",
            upload_url="https://r2.example.com/signed-url",
            expires_at=expires_at,
        )

        assert response.object_key == "users/123/media/file.mp3"
        assert response.upload_url == "https://r2.example.com/signed-url"
        assert response.expires_at == expires_at
