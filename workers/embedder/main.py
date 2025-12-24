from __future__ import annotations

import logging
import signal
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from supabase import Client, create_client

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.services.errors import RateLimitedError
from src.services.persist_supabase import save_chunks, update_recipe_embedding_status
from workers.embedder.config import WorkerConfig, get_config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("embedder-worker")

STATUS_PENDING = "pending"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_datetime(value: str | datetime | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        return None
    try:
        normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _safe_int(value: object, default: int = 0) -> int:
    return int(value) if value else default


def _safe_str(value: object) -> str | None:
    return str(value) if value else None


def _calculate_backoff_minutes(attempt_count: int) -> int:
    return 2 ** attempt_count


def _create_supabase_client(config: WorkerConfig) -> Client:
    if not config.supabase_url or not config.supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
    return create_client(config.supabase_url, config.supabase_key)


@dataclass
class EmbeddingJob:
    id: UUID
    user_id: UUID
    recipe_id: UUID
    payload: str
    status: str
    attempt_count: int
    max_attempts: int
    next_attempt_at: datetime | None
    locked_at: datetime | None
    locked_by: str | None
    error_message: str | None
    created_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None


def _row_to_job(row: dict[str, object]) -> EmbeddingJob:
    return EmbeddingJob(
        id=UUID(str(row["id"])),
        user_id=UUID(str(row["user_id"])),
        recipe_id=UUID(str(row["recipe_id"])),
        payload=str(row.get("payload") or ""),
        status=str(row.get("status") or ""),
        attempt_count=_safe_int(row.get("attempt_count")),
        max_attempts=_safe_int(row.get("max_attempts"), 5),
        next_attempt_at=_parse_datetime(row.get("next_attempt_at")),
        locked_at=_parse_datetime(row.get("locked_at")),
        locked_by=_safe_str(row.get("locked_by")),
        error_message=_safe_str(row.get("error_message")),
        created_at=_parse_datetime(row.get("created_at")),
        started_at=_parse_datetime(row.get("started_at")),
        finished_at=_parse_datetime(row.get("finished_at")),
    )


@dataclass
class StaleJobInfo:
    job_id: str
    attempt_count: int
    max_attempts: int

    @property
    def has_exceeded_attempts(self) -> bool:
        return self.attempt_count >= self.max_attempts


class EmbeddingWorker:
    def __init__(self, config: WorkerConfig, client: Client):
        self.config = config
        self.client = client
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
            raise ValueError(", ".join(errors))

    def _setup_signal_handlers(self) -> None:
        signal.signal(signal.SIGTERM, self._handle_shutdown_signal)
        signal.signal(signal.SIGINT, self._handle_shutdown_signal)

    def _log_startup_info(self) -> None:
        logger.info(
            "Starting embedding worker: id=%s, poll_interval=%ds",
            self.config.worker_id,
            self.config.poll_interval_seconds,
        )

    def _run_main_loop(self) -> None:
        empty_polls = 0
        poll_interval = float(self.config.poll_interval_seconds)

        while self.running:
            self._maybe_release_stale_locks()

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

    def _try_fetch_next_job(self) -> EmbeddingJob | None:
        now = _now_utc()
        try:
            result = self.client.rpc(
                "fetch_and_lock_embedding_job",
                {"p_worker_id": self.config.worker_id, "p_now": now.isoformat()},
            ).execute()
        except Exception as exc:
            logger.error("Error fetching embedding job: %s", exc)
            return None

        if not result.data:
            return None
        job = _row_to_job(result.data[0])
        logger.info("Locked embedding job: id=%s, attempt=%d", job.id, job.attempt_count)
        return job

    def _reached_max_jobs(self) -> bool:
        if self.config.max_jobs_per_run <= 0:
            return False
        if self.jobs_processed >= self.config.max_jobs_per_run:
            logger.info("Reached max jobs per run (%d), shutting down", self.config.max_jobs_per_run)
            return True
        return False

    def _calculate_backoff_interval(self, current_interval: float) -> float:
        return min(current_interval * 1.5, float(self.config.max_poll_interval_seconds))

    def _should_shutdown_on_empty_queue(self) -> bool:
        if not self.config.shutdown_on_empty:
            return False
        if self.last_job_time is None:
            return False
        idle_time = _now_utc() - self.last_job_time
        shutdown_threshold = timedelta(minutes=self.config.empty_queue_shutdown_minutes)
        if idle_time > shutdown_threshold:
            logger.info(
                "Queue empty for %d minutes, shutting down",
                self.config.empty_queue_shutdown_minutes,
            )
            return True
        return False

    def _process_job(self, job: EmbeddingJob) -> None:
        self._mark_job_started(job)
        try:
            update_recipe_embedding_status(
                self.client,
                str(job.recipe_id),
                str(job.user_id),
                STATUS_PROCESSING,
                None,
            )
            save_chunks(self.client, str(job.recipe_id), job.payload)
        except RateLimitedError as exc:
            self._handle_retryable_failure(job, str(exc), "Aguardando nova tentativa após limite da API")
        except Exception as exc:
            self._handle_retryable_failure(job, str(exc), None)
        else:
            self._mark_job_done(job)
        finally:
            self.current_job_id = None

    def _mark_job_started(self, job: EmbeddingJob) -> None:
        self.current_job_id = job.id
        self.last_job_time = _now_utc()
        logger.info(
            "Processing embedding job: id=%s, user=%s, recipe=%s, attempt=%d/%d",
            job.id,
            job.user_id,
            job.recipe_id,
            job.attempt_count,
            job.max_attempts,
        )

    def _mark_job_done(self, job: EmbeddingJob) -> None:
        update_recipe_embedding_status(
            self.client,
            str(job.recipe_id),
            str(job.user_id),
            STATUS_COMPLETED,
            None,
        )
        update_data = {
            "status": "DONE",
            "finished_at": _now_utc().isoformat(),
            "locked_at": None,
            "locked_by": None,
            "error_message": None,
        }
        result = self.client.table("embedding_jobs").update(update_data).eq("id", str(job.id)).execute()
        if result.data:
            self.jobs_processed += 1
            logger.info("Embedding job completed: id=%s", job.id)
        else:
            logger.error("Failed to mark embedding job done: id=%s", job.id)

    def _handle_retryable_failure(self, job: EmbeddingJob, error_message: str, status_message: str | None) -> None:
        if job.attempt_count >= job.max_attempts:
            self._handle_permanent_failure(job, error_message)
            return

        retry_at = _now_utc() + timedelta(minutes=_calculate_backoff_minutes(job.attempt_count))
        update_data = {
            "status": "QUEUED",
            "next_attempt_at": retry_at.isoformat(),
            "error_message": error_message[:500],
            "locked_at": None,
            "locked_by": None,
        }
        self.client.table("embedding_jobs").update(update_data).eq("id", str(job.id)).execute()
        update_recipe_embedding_status(
            self.client,
            str(job.recipe_id),
            str(job.user_id),
            STATUS_PENDING,
            status_message or "Aguardando nova tentativa",
        )
        logger.warning(
            "Embedding job failed, will retry: id=%s, attempt=%d/%d, next_retry=%s",
            job.id,
            job.attempt_count,
            job.max_attempts,
            retry_at.isoformat(),
        )

    def _handle_permanent_failure(self, job: EmbeddingJob, error_message: str) -> None:
        update_recipe_embedding_status(
            self.client,
            str(job.recipe_id),
            str(job.user_id),
            STATUS_FAILED,
            error_message,
        )
        update_data = {
            "status": "FAILED",
            "finished_at": _now_utc().isoformat(),
            "error_message": error_message[:500],
            "locked_at": None,
            "locked_by": None,
        }
        self.client.table("embedding_jobs").update(update_data).eq("id", str(job.id)).execute()
        logger.error("Embedding job permanently failed: id=%s, error=%s", job.id, error_message)

    def _maybe_release_stale_locks(self) -> None:
        now = _now_utc()
        if self.last_stale_check is None:
            self.last_stale_check = now
            return
        check_interval = timedelta(minutes=self.config.stale_lock_check_interval_minutes)
        if now - self.last_stale_check < check_interval:
            return
        self.last_stale_check = now
        released_count = self._release_stale_locks(self.config.lock_ttl_minutes)
        if released_count > 0:
            logger.info("Released %d stale embedding locks", released_count)

    def _release_stale_locks(self, lock_ttl_minutes: int) -> int:
        cutoff = _now_utc() - timedelta(minutes=lock_ttl_minutes)
        result = (
            self.client.table("embedding_jobs")
            .select("id, attempt_count, max_attempts")
            .eq("status", "RUNNING")
            .lt("locked_at", cutoff.isoformat())
            .execute()
        )
        if not result.data:
            return 0
        stale_jobs = [
            StaleJobInfo(
                job_id=row["id"],
                attempt_count=_safe_int(row.get("attempt_count")),
                max_attempts=_safe_int(row.get("max_attempts"), self.config.max_attempts),
            )
            for row in result.data
        ]
        released_count = 0
        for job in stale_jobs:
            update_data = self._build_stale_release_update(job)
            self.client.table("embedding_jobs").update(update_data).eq("id", job.job_id).execute()
            released_count += 1
        return released_count

    def _build_stale_release_update(self, job: StaleJobInfo) -> dict[str, str | None]:
        base_data: dict[str, str | None] = {
            "locked_at": None,
            "locked_by": None,
        }
        if job.has_exceeded_attempts:
            base_data["status"] = "FAILED"
            base_data["error_message"] = "Job timed out after max attempts"
            base_data["finished_at"] = _now_utc().isoformat()
        else:
            retry_at = _now_utc() + timedelta(minutes=_calculate_backoff_minutes(job.attempt_count))
            base_data["status"] = "QUEUED"
            base_data["next_attempt_at"] = retry_at.isoformat()
            base_data["error_message"] = "Lock timed out, requeued for retry"
        return base_data

    def _handle_shutdown_signal(self, signum: int, frame: object) -> None:
        logger.info("Received shutdown signal %d", signum)
        self.running = False

    def _shutdown(self) -> None:
        logger.info("Worker shutting down: jobs_processed=%d", self.jobs_processed)
        if self.current_job_id:
            logger.info("Waiting for current job to complete: %s", self.current_job_id)
        logger.info("Worker shutdown complete")


def main() -> None:
    config = get_config()
    client = _create_supabase_client(config)
    worker = EmbeddingWorker(config=config, client=client)
    worker.start()


if __name__ == "__main__":
    main()
