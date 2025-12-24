from __future__ import annotations

import pytest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from uuid import UUID, uuid4
from unittest.mock import MagicMock, patch

from src.app.domain.errors import (
    InvalidMediaError,
    InvalidObjectKeyError,
    StorageDownloadError,
    TranscriptionProcessingError,
    WorkerConfigurationError,
)
from src.app.domain.models import (
    JobStatus,
    TranscriptionJob,
    TranscriptionResult,
    TranscriptionSegment,
)
from workers.transcriber.config import WorkerConfig
from workers.transcriber.main import TranscriberWorker


class JobQueueRepositoryStub:
    def __init__(self) -> None:
        self.jobs_to_return: list[TranscriptionJob] = []
        self.marked_done_jobs: list[UUID] = []
        self.marked_failed_jobs: list[tuple[UUID, str, bool]] = []
        self.released_locks_count = 0

    def fetch_and_lock_next_job(self, worker_id: str) -> TranscriptionJob | None:
        if self.jobs_to_return:
            return self.jobs_to_return.pop(0)
        return None

    def mark_done(
        self,
        job_id: UUID,
        transcript_text: str,
        segments_json: list[dict],
        language: str,
        duration_sec: int,
        model_version: str,
    ) -> bool:
        self.marked_done_jobs.append(job_id)
        return True

    def mark_failed(
        self,
        job_id: UUID,
        error_message: str,
        permanent: bool = False,
        retry_at: datetime | None = None,
    ) -> bool:
        self.marked_failed_jobs.append((job_id, error_message, permanent))
        return True

    def release_stale_locks(self, lock_ttl_minutes: int = 30) -> int:
        self.released_locks_count += 1
        return 0


class QuotaRepositoryStub:
    def __init__(self) -> None:
        self.confirmed_minutes: list[tuple[UUID, int, int]] = []

    def confirm_actual_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        actual_minutes: int,
    ) -> None:
        self.confirmed_minutes.append((user_id, estimated_minutes, actual_minutes))


class StorageProviderStub:
    def __init__(self) -> None:
        self.downloaded_files: list[tuple[str, Path]] = []
        self.metadata_to_return: dict[str, object] = {"content_length": 5 * 1024 * 1024}
        self.should_fail_download = False
        self.should_fail_metadata = False

    def download_to_path(self, object_key: str, target_path: Path) -> Path:
        if self.should_fail_download:
            raise StorageDownloadError(object_key, "Simulated download failure")
        self.downloaded_files.append((object_key, target_path))
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.touch()
        return target_path

    def get_object_metadata(self, object_key: str) -> dict[str, object]:
        if self.should_fail_metadata:
            raise StorageDownloadError(object_key, "Simulated metadata failure")
        return self.metadata_to_return


class TranscriptionPipelineStub:
    def __init__(self) -> None:
        self.transcribed_files: list[Path] = []
        self.should_fail = False
        self.fail_retryable = True
        self.should_fail_invalid_media = False

    def transcribe(self, media_path: Path) -> TranscriptionResult:
        if self.should_fail_invalid_media:
            raise InvalidMediaError("Simulated invalid media")
        if self.should_fail:
            raise TranscriptionProcessingError("Simulated failure", retryable=self.fail_retryable)
        self.transcribed_files.append(media_path)
        return TranscriptionResult(
            text="Test transcription text",
            segments=[
                TranscriptionSegment(start=0.0, end=5.0, text="Test segment"),
            ],
            language="pt",
            duration_sec=120.0,
            model_version="medium",
        )


def create_test_config() -> WorkerConfig:
    return WorkerConfig(
        worker_id="test-worker",
        poll_interval_seconds=1,
        max_poll_interval_seconds=5,
        max_jobs_per_run=1,
        shutdown_on_empty=False,
        empty_queue_shutdown_minutes=10,
        lock_ttl_minutes=30,
        stale_lock_check_interval_minutes=5,
        temp_dir="/tmp/test-transcription",
        default_language="pt",
        graceful_shutdown_timeout_seconds=30,
        supabase_url="https://test.supabase.co",
        supabase_key="test-key",
        r2_account_id="test-account",
        r2_access_key_id="test-access-key",
        r2_secret_access_key="test-secret",
        r2_bucket_name="test-bucket",
    )


def create_test_job() -> TranscriptionJob:
    return TranscriptionJob(
        id=uuid4(),
        user_id=uuid4(),
        object_key="users/test/media/2024/01/abc123_test.mp3",
        status=JobStatus.RUNNING,
        priority=0,
        attempt_count=0,
        max_attempts=3,
        created_at=datetime.now(timezone.utc),
    )


class TestTranscriberWorkerValidation:
    def test_validate_object_key_valid(self) -> None:
        config = create_test_config()
        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=StorageProviderStub(),
            transcription_pipeline=TranscriptionPipelineStub(),
        )

        result = worker._validate_object_key("users/test/media/2024/01/file.mp3")
        assert result == "users/test/media/2024/01/file.mp3"

    def test_validate_object_key_empty_raises(self) -> None:
        config = create_test_config()
        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=StorageProviderStub(),
            transcription_pipeline=TranscriptionPipelineStub(),
        )

        with pytest.raises(InvalidObjectKeyError) as exc_info:
            worker._validate_object_key("")

        assert "cannot be empty" in str(exc_info.value)

    def test_validate_object_key_path_traversal_raises(self) -> None:
        config = create_test_config()
        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=StorageProviderStub(),
            transcription_pipeline=TranscriptionPipelineStub(),
        )

        with pytest.raises(InvalidObjectKeyError) as exc_info:
            worker._validate_object_key("../../../etc/passwd")

        assert "path traversal" in str(exc_info.value)

    def test_validate_object_key_dot_prefix_raises(self) -> None:
        config = create_test_config()
        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=StorageProviderStub(),
            transcription_pipeline=TranscriptionPipelineStub(),
        )

        with pytest.raises(InvalidObjectKeyError) as exc_info:
            worker._validate_object_key(".hidden_file")

        assert "cannot start with dot" in str(exc_info.value)


class TestTranscriberWorkerJobProcessing:
    def test_process_job_success(self, tmp_path: Path) -> None:
        config = create_test_config()
        config.temp_dir = str(tmp_path)

        job_repo = JobQueueRepositoryStub()
        quota_repo = QuotaRepositoryStub()
        storage = StorageProviderStub()
        pipeline = TranscriptionPipelineStub()

        job = create_test_job()
        job_repo.jobs_to_return = [job]

        worker = TranscriberWorker(
            config=config,
            job_repository=job_repo,
            quota_repository=quota_repo,
            storage_provider=storage,
            transcription_pipeline=pipeline,
        )

        worker._process_job(job)

        assert job.id in job_repo.marked_done_jobs
        assert len(pipeline.transcribed_files) == 1
        assert len(quota_repo.confirmed_minutes) == 1

    def test_process_job_invalid_media_permanent_failure(self, tmp_path: Path) -> None:
        config = create_test_config()
        config.temp_dir = str(tmp_path)

        job_repo = JobQueueRepositoryStub()
        quota_repo = QuotaRepositoryStub()
        storage = StorageProviderStub()
        pipeline = TranscriptionPipelineStub()
        pipeline.should_fail_invalid_media = True

        job = create_test_job()

        worker = TranscriberWorker(
            config=config,
            job_repository=job_repo,
            quota_repository=quota_repo,
            storage_provider=storage,
            transcription_pipeline=pipeline,
        )

        worker._process_job(job)

        assert len(job_repo.marked_failed_jobs) == 1
        failed_job_id, error_msg, is_permanent = job_repo.marked_failed_jobs[0]
        assert failed_job_id == job.id
        assert is_permanent is True

    def test_process_job_retryable_failure(self, tmp_path: Path) -> None:
        config = create_test_config()
        config.temp_dir = str(tmp_path)

        job_repo = JobQueueRepositoryStub()
        quota_repo = QuotaRepositoryStub()
        storage = StorageProviderStub()
        pipeline = TranscriptionPipelineStub()
        pipeline.should_fail = True
        pipeline.fail_retryable = True

        job = create_test_job()

        worker = TranscriberWorker(
            config=config,
            job_repository=job_repo,
            quota_repository=quota_repo,
            storage_provider=storage,
            transcription_pipeline=pipeline,
        )

        worker._process_job(job)

        assert len(job_repo.marked_failed_jobs) == 1
        failed_job_id, error_msg, is_permanent = job_repo.marked_failed_jobs[0]
        assert failed_job_id == job.id
        assert is_permanent is False

    def test_process_job_storage_download_failure(self, tmp_path: Path) -> None:
        config = create_test_config()
        config.temp_dir = str(tmp_path)

        job_repo = JobQueueRepositoryStub()
        quota_repo = QuotaRepositoryStub()
        storage = StorageProviderStub()
        storage.should_fail_download = True
        pipeline = TranscriptionPipelineStub()

        job = create_test_job()

        worker = TranscriberWorker(
            config=config,
            job_repository=job_repo,
            quota_repository=quota_repo,
            storage_provider=storage,
            transcription_pipeline=pipeline,
        )

        worker._process_job(job)

        assert len(job_repo.marked_failed_jobs) == 1
        failed_job_id, error_msg, is_permanent = job_repo.marked_failed_jobs[0]
        assert failed_job_id == job.id
        assert is_permanent is False


class TestTranscriberWorkerConfiguration:
    def test_configuration_validation_passes(self) -> None:
        config = create_test_config()
        errors = config.validate()
        assert len(errors) == 0

    def test_configuration_validation_missing_supabase_url(self) -> None:
        config = create_test_config()
        config.supabase_url = ""
        errors = config.validate()
        assert "SUPABASE_URL is required" in errors

    def test_configuration_validation_missing_r2_bucket(self) -> None:
        config = create_test_config()
        config.r2_bucket_name = ""
        errors = config.validate()
        assert "R2_BUCKET_NAME is required" in errors


class TestTranscriberWorkerBackoff:
    def test_calculate_backoff_interval(self) -> None:
        config = create_test_config()
        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=StorageProviderStub(),
            transcription_pipeline=TranscriptionPipelineStub(),
        )

        result = worker._calculate_backoff_interval(2.0)
        assert result == 3.0

    def test_calculate_backoff_interval_max_cap(self) -> None:
        config = create_test_config()
        config.max_poll_interval_seconds = 5
        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=StorageProviderStub(),
            transcription_pipeline=TranscriptionPipelineStub(),
        )

        result = worker._calculate_backoff_interval(10.0)
        assert result == 5.0


class TestTranscriberWorkerMaxJobs:
    def test_reached_max_jobs_false_when_zero_limit(self) -> None:
        config = create_test_config()
        config.max_jobs_per_run = 0
        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=StorageProviderStub(),
            transcription_pipeline=TranscriptionPipelineStub(),
        )

        assert worker._reached_max_jobs() is False

    def test_reached_max_jobs_true_when_limit_reached(self) -> None:
        config = create_test_config()
        config.max_jobs_per_run = 5
        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=StorageProviderStub(),
            transcription_pipeline=TranscriptionPipelineStub(),
        )
        worker.jobs_processed = 5

        assert worker._reached_max_jobs() is True


class TestTranscriberWorkerShutdown:
    def test_should_shutdown_on_empty_queue_false_when_disabled(self) -> None:
        config = create_test_config()
        config.shutdown_on_empty = False
        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=StorageProviderStub(),
            transcription_pipeline=TranscriptionPipelineStub(),
        )

        assert worker._should_shutdown_on_empty_queue() is False

    def test_should_shutdown_on_empty_queue_true_when_idle_threshold_exceeded(self) -> None:
        config = create_test_config()
        config.shutdown_on_empty = True
        config.empty_queue_shutdown_minutes = 5
        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=StorageProviderStub(),
            transcription_pipeline=TranscriptionPipelineStub(),
        )
        worker.last_job_time = datetime.now(timezone.utc) - timedelta(minutes=10)

        assert worker._should_shutdown_on_empty_queue() is True


class TestTranscriberWorkerEstimateDuration:
    def test_estimate_duration_minutes_from_metadata(self, tmp_path: Path) -> None:
        config = create_test_config()
        config.temp_dir = str(tmp_path)
        storage = StorageProviderStub()
        storage.metadata_to_return = {"content_length": 10 * 1024 * 1024}

        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=storage,
            transcription_pipeline=TranscriptionPipelineStub(),
        )

        result = worker._estimate_duration_minutes("test.mp3")
        assert result == 10

    def test_estimate_duration_minutes_default_on_failure(self, tmp_path: Path) -> None:
        config = create_test_config()
        config.temp_dir = str(tmp_path)
        storage = StorageProviderStub()
        storage.should_fail_metadata = True

        worker = TranscriberWorker(
            config=config,
            job_repository=JobQueueRepositoryStub(),
            quota_repository=QuotaRepositoryStub(),
            storage_provider=storage,
            transcription_pipeline=TranscriptionPipelineStub(),
        )

        result = worker._estimate_duration_minutes("test.mp3")
        assert result == 5
