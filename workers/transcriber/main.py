from __future__ import annotations

import logging
import signal
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path, PurePosixPath
from uuid import UUID

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.app.domain.errors import (
    InvalidMediaError,
    InvalidObjectKeyError,
    StorageDownloadError,
    StorageTimeoutError,
    TempFileCleanupError,
    TranscriptionProcessingError,
    TranscriptionTimeoutError,
    WorkerConfigurationError,
)
from src.app.domain.models import TranscriptionJob, TranscriptionResult
from src.app.infra.db.base import JobQueueRepository, QuotaRepository
from src.app.infra.storage.base import StorageProvider
from src.app.services.transcription_pipeline import TranscriptionPipeline
from workers.transcriber.config import WorkerConfig, get_config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("transcriber-worker")

DOWNLOAD_TIMEOUT_SECONDS = 300
METADATA_TIMEOUT_SECONDS = 30
DEFAULT_ESTIMATED_MINUTES = 5
BYTES_PER_MB = 1024 * 1024


class TranscriberWorker:
    def __init__(
        self,
        config: WorkerConfig,
        job_repository: JobQueueRepository,
        quota_repository: QuotaRepository,
        storage_provider: StorageProvider,
        transcription_pipeline: TranscriptionPipeline,
    ):
        self.config = config
        self.job_repo = job_repository
        self.quota_repo = quota_repository
        self.storage = storage_provider
        self.pipeline = transcription_pipeline
        self.running = False
        self.current_job_id: UUID | None = None
        self.jobs_processed = 0
        self.last_job_time: datetime | None = None
        self.last_stale_check: datetime | None = None

    def start(self) -> None:
        self._validate_configuration()
        self._setup_signal_handlers()
        self._log_startup_info()
        self.running = True
        self._run_main_loop()
        self._shutdown()

    def _validate_configuration(self) -> None:
        errors = self.config.validate()
        if errors:
            raise WorkerConfigurationError(errors)

    def _setup_signal_handlers(self) -> None:
        signal.signal(signal.SIGTERM, self._handle_shutdown_signal)
        signal.signal(signal.SIGINT, self._handle_shutdown_signal)

    def _log_startup_info(self) -> None:
        logger.info(
            "Starting transcription worker: id=%s, poll_interval=%ds",
            self.config.worker_id,
            self.config.poll_interval_seconds,
        )

    def _run_main_loop(self) -> None:
        empty_polls = 0
        poll_interval = float(self.config.poll_interval_seconds)

        while self.running:
            should_continue = self._process_main_loop_iteration(empty_polls, poll_interval)

            if not should_continue:
                break

            job = self._try_fetch_next_job()

            if job:
                empty_polls = 0
                poll_interval = float(self.config.poll_interval_seconds)
                self._process_job(job)

                if self._reached_max_jobs():
                    break
            else:
                empty_polls += 1
                poll_interval = self._calculate_backoff_interval(poll_interval)

                if self._should_shutdown_on_empty_queue():
                    break

                logger.debug(
                    "No jobs available, sleeping %.1fs (empty_polls=%d)",
                    poll_interval,
                    empty_polls,
                )

            time.sleep(poll_interval)

    def _process_main_loop_iteration(self, empty_polls: int, poll_interval: float) -> bool:
        self._maybe_release_stale_locks()
        return True

    def _try_fetch_next_job(self) -> TranscriptionJob | None:
        return self.job_repo.fetch_and_lock_next_job(worker_id=self.config.worker_id)

    def _reached_max_jobs(self) -> bool:
        if self.config.max_jobs_per_run <= 0:
            return False

        if self.jobs_processed >= self.config.max_jobs_per_run:
            logger.info(
                "Reached max jobs per run (%d), shutting down",
                self.config.max_jobs_per_run,
            )
            return True
        return False

    def _calculate_backoff_interval(self, current_interval: float) -> float:
        return min(
            current_interval * 1.5,
            float(self.config.max_poll_interval_seconds),
        )

    def _should_shutdown_on_empty_queue(self) -> bool:
        if not self.config.shutdown_on_empty:
            return False

        if self.last_job_time is None:
            return False

        idle_time = datetime.now(timezone.utc) - self.last_job_time
        shutdown_threshold = timedelta(minutes=self.config.empty_queue_shutdown_minutes)

        if idle_time > shutdown_threshold:
            logger.info(
                "Queue empty for %d minutes, shutting down",
                self.config.empty_queue_shutdown_minutes,
            )
            return True
        return False

    def _process_job(self, job: TranscriptionJob) -> None:
        self._mark_job_started(job)
        temp_file_path: Path | None = None
        estimated_minutes = DEFAULT_ESTIMATED_MINUTES

        try:
            validated_object_key = self._validate_object_key(job.object_key)
            temp_file_path = self._download_media_file(job.id, validated_object_key)
            estimated_minutes = self._estimate_duration_minutes(validated_object_key)
            transcription_result = self._execute_transcription(temp_file_path)
            self._save_transcription_results(job, transcription_result)
            self._reconcile_quota(job.user_id, estimated_minutes, transcription_result.duration_sec)

        except InvalidMediaError as error:
            self._handle_permanent_failure(job.id, str(error))

        except TranscriptionProcessingError as error:
            self._handle_processing_error(job.id, error)

        except (StorageDownloadError, StorageTimeoutError) as error:
            self._handle_retryable_failure(job.id, str(error))

        except InvalidObjectKeyError as error:
            self._handle_permanent_failure(job.id, str(error))

        finally:
            self._cleanup_temp_file(temp_file_path)
            self.current_job_id = None

    def _mark_job_started(self, job: TranscriptionJob) -> None:
        self.current_job_id = job.id
        self.last_job_time = datetime.now(timezone.utc)

        logger.info(
            "Processing job: id=%s, user=%s, object_key=%s, attempt=%d/%d",
            job.id,
            job.user_id,
            job.object_key,
            job.attempt_count + 1,
            job.max_attempts,
        )

    def _validate_object_key(self, object_key: str) -> str:
        if not object_key or not object_key.strip():
            raise InvalidObjectKeyError(object_key, "Object key cannot be empty")

        safe_name = PurePosixPath(object_key).name

        if not safe_name:
            raise InvalidObjectKeyError(object_key, "Object key has no valid filename")

        if safe_name.startswith("."):
            raise InvalidObjectKeyError(object_key, "Object key cannot start with dot")

        if ".." in object_key:
            raise InvalidObjectKeyError(object_key, "Object key cannot contain path traversal")

        return object_key

    def _download_media_file(self, job_id: UUID, object_key: str) -> Path:
        temp_dir = Path(self.config.temp_dir)
        temp_dir.mkdir(parents=True, exist_ok=True)

        file_extension = Path(object_key).suffix or ".mp3"
        temp_file_path = temp_dir / f"{job_id}{file_extension}"

        logger.info("Downloading from R2: %s -> %s", object_key, temp_file_path)

        self.storage.download_to_path(object_key, temp_file_path)

        return temp_file_path

    def _estimate_duration_minutes(self, object_key: str) -> int:
        try:
            metadata = self.storage.get_object_metadata(object_key)
            content_length = metadata.get("content_length", 0) or 0
            size_mb = content_length / BYTES_PER_MB
            return max(1, int(size_mb))
        except (StorageDownloadError, StorageTimeoutError, KeyError, TypeError):
            return DEFAULT_ESTIMATED_MINUTES

    def _execute_transcription(self, media_path: Path) -> TranscriptionResult:
        logger.info("Starting transcription...")
        return self.pipeline.transcribe(media_path)

    def _save_transcription_results(
        self,
        job: TranscriptionJob,
        result: TranscriptionResult,
    ) -> None:
        segments_json = [
            {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text,
            }
            for segment in result.segments
        ]

        success = self.job_repo.mark_done(
            job_id=job.id,
            transcript_text=result.text,
            segments_json=segments_json,
            language=result.language,
            duration_sec=int(result.duration_sec),
            model_version=result.model_version,
        )

        if success:
            self.jobs_processed += 1
            logger.info(
                "Job completed successfully: id=%s, duration=%ds, segments=%d",
                job.id,
                int(result.duration_sec),
                len(segments_json),
            )
        else:
            logger.error("Failed to save job results: id=%s", job.id)

    def _reconcile_quota(
        self,
        user_id: UUID,
        estimated_minutes: int,
        actual_duration_sec: float,
    ) -> None:
        actual_minutes = int(actual_duration_sec / 60) + 1
        self.quota_repo.confirm_actual_minutes(
            user_id=user_id,
            estimated_minutes=estimated_minutes,
            actual_minutes=actual_minutes,
        )

    def _handle_permanent_failure(self, job_id: UUID, error_message: str) -> None:
        logger.error("Job permanently failed: id=%s, error=%s", job_id, error_message)
        self.job_repo.mark_failed(
            job_id=job_id,
            error_message=error_message,
            permanent=True,
        )

    def _handle_processing_error(
        self,
        job_id: UUID,
        error: TranscriptionProcessingError,
    ) -> None:
        if error.retryable:
            self._handle_retryable_failure(job_id, str(error))
        else:
            self._handle_permanent_failure(job_id, str(error))

    def _handle_retryable_failure(self, job_id: UUID, error_message: str) -> None:
        logger.warning("Job failed, will retry: id=%s, error=%s", job_id, error_message)
        self.job_repo.mark_failed(
            job_id=job_id,
            error_message=error_message,
            permanent=False,
        )

    def _cleanup_temp_file(self, temp_file_path: Path | None) -> None:
        if temp_file_path is None:
            return

        if not temp_file_path.exists():
            return

        try:
            temp_file_path.unlink()
            logger.debug("Cleaned up temp file: %s", temp_file_path)
        except OSError as os_error:
            logger.warning(
                "Failed to cleanup temp file %s: %s",
                temp_file_path,
                os_error,
            )

    def _maybe_release_stale_locks(self) -> None:
        now = datetime.now(timezone.utc)

        if self.last_stale_check is None:
            self.last_stale_check = now
            return

        check_interval = timedelta(minutes=self.config.stale_lock_check_interval_minutes)

        if now - self.last_stale_check < check_interval:
            return

        self.last_stale_check = now

        released_count = self.job_repo.release_stale_locks(
            lock_ttl_minutes=self.config.lock_ttl_minutes,
        )

        if released_count > 0:
            logger.info("Released %d stale locks", released_count)

    def _handle_shutdown_signal(self, signum: int, frame: object) -> None:
        logger.info("Received shutdown signal %d", signum)
        self.running = False

    def _shutdown(self) -> None:
        logger.info("Worker shutting down: jobs_processed=%d", self.jobs_processed)

        if self.current_job_id:
            logger.info("Waiting for current job to complete: %s", self.current_job_id)

        logger.info("Worker shutdown complete")


def create_default_dependencies(config: WorkerConfig) -> tuple[
    JobQueueRepository,
    QuotaRepository,
    StorageProvider,
    TranscriptionPipeline,
]:
    from src.app.infra.db.supabase_jobs_repo import (
        SupabaseJobQueueRepository,
        SupabaseQuotaRepository,
    )
    from src.app.infra.storage.r2_provider import R2StorageProvider

    job_repository = SupabaseJobQueueRepository()
    quota_repository = SupabaseQuotaRepository()
    storage_provider = R2StorageProvider()
    transcription_pipeline = TranscriptionPipeline(language=config.default_language)

    return job_repository, quota_repository, storage_provider, transcription_pipeline


def main() -> None:
    config = get_config()
    job_repo, quota_repo, storage, pipeline = create_default_dependencies(config)

    worker = TranscriberWorker(
        config=config,
        job_repository=job_repo,
        quota_repository=quota_repo,
        storage_provider=storage,
        transcription_pipeline=pipeline,
    )

    worker.start()


if __name__ == "__main__":
    main()
