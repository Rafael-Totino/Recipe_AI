from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4

from supabase import Client, create_client

from src.app.domain.errors import JobNotFoundError, JobLockError, JobRepositoryError
from src.app.domain.models import JobStatus, TranscriptionJob, UsageDaily, QuotaCheck
from src.app.infra.db.base import JobQueueRepository, QuotaRepository

logger = logging.getLogger(__name__)

DEFAULT_MAX_ATTEMPTS = 3
DATE_FORMAT = "%Y-%m-%d"


def _get_today() -> str:
    return datetime.now(timezone.utc).strftime(DATE_FORMAT)


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


def _row_to_job(row: dict[str, str | int | float | None]) -> TranscriptionJob:
    return TranscriptionJob(
        id=UUID(str(row["id"])),
        user_id=UUID(str(row["user_id"])),
        object_key=str(row["object_key"]),
        status=JobStatus(str(row["status"])),
        recipe_id=UUID(str(row["recipe_id"])) if row.get("recipe_id") else None,
        priority=_safe_int(row.get("priority")),
        locked_at=_parse_datetime(row.get("locked_at")),
        locked_by=_safe_str(row.get("locked_by")),
        attempt_count=_safe_int(row.get("attempt_count")),
        max_attempts=_safe_int(row.get("max_attempts"), DEFAULT_MAX_ATTEMPTS),
        next_attempt_at=_parse_datetime(row.get("next_attempt_at")),
        error_message=_safe_str(row.get("error_message")),
        created_at=_parse_datetime(row.get("created_at")),
        started_at=_parse_datetime(row.get("started_at")),
        finished_at=_parse_datetime(row.get("finished_at")),
        duration_sec=_safe_int(row.get("duration_sec")) if row.get("duration_sec") else None,
        estimated_duration_sec=_safe_int(row.get("estimated_duration_sec")) if row.get("estimated_duration_sec") else None,
        stage=_safe_str(row.get("stage")),
        progress=float(row.get("progress")) if row.get("progress") is not None else None,
        last_heartbeat_at=_parse_datetime(row.get("last_heartbeat_at")),
        language=_safe_str(row.get("language")),
        transcript_text=_safe_str(row.get("transcript_text")),
        segments_json=row.get("segments_json"),
        model_version=_safe_str(row.get("model_version")),
    )


def _calculate_backoff_minutes(attempt_count: int) -> int:
    return 2 ** attempt_count


def _create_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
    return create_client(url, key)


@dataclass
class StaleJobInfo:
    job_id: str
    attempt_count: int
    max_attempts: int

    @property
    def has_exceeded_attempts(self) -> bool:
        return self.attempt_count >= self.max_attempts


class SupabaseJobQueueRepository(JobQueueRepository):
    TABLE_NAME = "transcription_jobs"

    def __init__(self, client: Client | None = None):
        self._client = client or _create_supabase_client()
        logger.info("SupabaseJobQueueRepository initialized")

    def enqueue_transcription_job(
        self,
        user_id: UUID,
        object_key: str,
        recipe_id: UUID | None = None,
        estimated_duration_sec: int = 0,
        priority: int = 0,
    ) -> TranscriptionJob:
        job_data = self._build_job_data(user_id, object_key, recipe_id, estimated_duration_sec, priority)

        try:
            result = self._client.table(self.TABLE_NAME).insert(job_data).execute()

            if not result.data:
                raise JobLockError("Failed to create job")

            job = _row_to_job(result.data[0])
            logger.info("Created transcription job: id=%s, user=%s, object_key=%s", job.id, user_id, object_key)
            return job

        except JobLockError:
            raise
        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error enqueueing job: %s", error)
            raise JobRepositoryError("enqueue", str(error)) from error

    def _build_job_data(
        self,
        user_id: UUID,
        object_key: str,
        recipe_id: UUID | None,
        estimated_duration_sec: int,
        priority: int,
    ) -> dict[str, str | int]:
        data: dict[str, str | int] = {
            "id": str(uuid4()),
            "user_id": str(user_id),
            "object_key": object_key,
            "status": JobStatus.QUEUED.value,
            "priority": priority,
            "attempt_count": 0,
            "max_attempts": DEFAULT_MAX_ATTEMPTS,
            "created_at": _now_utc().isoformat(),
            "estimated_duration_sec": estimated_duration_sec,
        }

        if recipe_id:
            data["recipe_id"] = str(recipe_id)

        return data

    def fetch_and_lock_next_job(
        self,
        worker_id: str,
        now_ts: datetime | None = None,
    ) -> TranscriptionJob | None:
        now = now_ts or _now_utc()

        try:
            result = self._client.rpc(
                "fetch_and_lock_transcription_job",
                {"p_worker_id": worker_id, "p_now": now.isoformat()}
            ).execute()

            if not result.data:
                logger.debug("No jobs available for worker %s", worker_id)
                return None

            job = _row_to_job(result.data[0])
            logger.info("Locked job: id=%s, worker=%s, attempt=%d", job.id, worker_id, job.attempt_count)
            return job

        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error fetching job: %s", error)
            return None

    def mark_running(
        self,
        job_id: UUID,
        worker_id: str,
        started_at: datetime | None = None,
        stage: str | None = None,
        progress: float | None = None,
        last_heartbeat_at: datetime | None = None,
    ) -> bool:
        now = started_at or _now_utc()

        try:
            current_attempt = self._get_current_attempt_count(job_id)

            update_data = {
                "status": JobStatus.RUNNING.value,
                "locked_by": worker_id,
                "locked_at": now.isoformat(),
                "started_at": now.isoformat(),
                "attempt_count": current_attempt + 1,
            }

            if stage is not None:
                update_data["stage"] = stage

            if progress is not None:
                update_data["progress"] = progress

            heartbeat_time = last_heartbeat_at or now
            if last_heartbeat_at is not None:
                update_data["last_heartbeat_at"] = heartbeat_time.isoformat()

            result = self._client.table(self.TABLE_NAME).update(update_data).eq("id", str(job_id)).execute()

            if result.data:
                logger.info("Job marked as RUNNING: id=%s, worker=%s", job_id, worker_id)
                return True
            return False

        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error marking job running: %s", error)
            return False

    def _get_current_attempt_count(self, job_id: UUID) -> int:
        result = (
            self._client.table(self.TABLE_NAME)
            .select("attempt_count")
            .eq("id", str(job_id))
            .single()
            .execute()
        )
        return _safe_int(result.data.get("attempt_count")) if result.data else 0

    def mark_done(
        self,
        job_id: UUID,
        transcript_text: str,
        segments_json: list[dict],
        language: str,
        duration_sec: int,
        model_version: str,
    ) -> bool:
        now = _now_utc()
        update_data = {
            "status": JobStatus.DONE.value,
            "stage": "DONE",
            "progress": 100,
            "finished_at": now.isoformat(),
            "last_heartbeat_at": now.isoformat(),
            "transcript_text": transcript_text,
            "segments_json": segments_json,
            "language": language,
            "duration_sec": duration_sec,
            "model_version": model_version,
            "locked_at": None,
            "locked_by": None,
            "error_message": None,
        }

        try:
            result = self._client.table(self.TABLE_NAME).update(update_data).eq("id", str(job_id)).execute()

            if result.data:
                logger.info("Job completed: id=%s, duration=%ds, language=%s", job_id, duration_sec, language)
                return True
            return False

        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error marking job done: %s", error)
            return False

    def mark_failed(
        self,
        job_id: UUID,
        error_message: str,
        retry_at: datetime | None = None,
        permanent: bool = False,
    ) -> bool:
        try:
            job_info = self._get_job_retry_info(job_id)
            if not job_info:
                return False

            should_retry = not permanent and job_info["attempt_count"] < job_info["max_attempts"]
            update_data = self._build_failure_update(error_message, should_retry, job_info, retry_at)

            self._log_failure(job_id, should_retry, job_info, error_message, retry_at)

            result = self._client.table(self.TABLE_NAME).update(update_data).eq("id", str(job_id)).execute()
            return bool(result.data)

        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error marking job failed: %s", error)
            return False

    def _get_job_retry_info(self, job_id: UUID) -> dict[str, int] | None:
        result = (
            self._client.table(self.TABLE_NAME)
            .select("attempt_count, max_attempts")
            .eq("id", str(job_id))
            .single()
            .execute()
        )

        if not result.data:
            return None

        return {
            "attempt_count": _safe_int(result.data.get("attempt_count")),
            "max_attempts": _safe_int(result.data.get("max_attempts"), DEFAULT_MAX_ATTEMPTS),
        }

    def _build_failure_update(
        self,
        error_message: str,
        should_retry: bool,
        job_info: dict[str, int],
        retry_at: datetime | None,
    ) -> dict[str, str | None]:
        base_data: dict[str, str | None] = {
            "error_message": error_message,
            "locked_at": None,
            "locked_by": None,
            "last_heartbeat_at": _now_utc().isoformat(),
        }

        if should_retry:
            calculated_retry = retry_at or (_now_utc() + timedelta(minutes=_calculate_backoff_minutes(job_info["attempt_count"])))
            base_data["status"] = JobStatus.QUEUED.value
            base_data["next_attempt_at"] = calculated_retry.isoformat()
            base_data["stage"] = "QUEUED"
            base_data["progress"] = 0
        else:
            base_data["status"] = JobStatus.FAILED.value
            base_data["finished_at"] = _now_utc().isoformat()
            base_data["stage"] = "FAILED"

        return base_data

    def _log_failure(
        self,
        job_id: UUID,
        should_retry: bool,
        job_info: dict[str, int],
        error_message: str,
        retry_at: datetime | None,
    ) -> None:
        if should_retry:
            logger.warning(
                "Job failed, will retry: id=%s, attempt=%d/%d, next_retry=%s, error=%s",
                job_id, job_info["attempt_count"], job_info["max_attempts"], retry_at, error_message,
            )
        else:
            logger.error(
                "Job permanently failed: id=%s, attempts=%d, error=%s",
                job_id, job_info["attempt_count"], error_message,
            )

    def release_stale_locks(self, lock_ttl_minutes: int = 30) -> int:
        cutoff = _now_utc() - timedelta(minutes=lock_ttl_minutes)

        try:
            stale_jobs = self._find_stale_jobs(cutoff)
            if not stale_jobs:
                return 0

            released_count = sum(1 for job in stale_jobs if self._release_single_stale_lock(job))

            if released_count > 0:
                logger.info("Released %d stale locks", released_count)

            return released_count

        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error releasing stale locks: %s", error)
            return 0

    def _find_stale_jobs(self, cutoff: datetime) -> list[StaleJobInfo]:
        result = (
            self._client.table(self.TABLE_NAME)
            .select("id, attempt_count, max_attempts")
            .eq("status", JobStatus.RUNNING.value)
            .lt("locked_at", cutoff.isoformat())
            .execute()
        )

        if not result.data:
            return []

        return [
            StaleJobInfo(
                job_id=row["id"],
                attempt_count=_safe_int(row.get("attempt_count")),
                max_attempts=_safe_int(row.get("max_attempts"), DEFAULT_MAX_ATTEMPTS),
            )
            for row in result.data
        ]

    def _release_single_stale_lock(self, job: StaleJobInfo) -> bool:
        update_data = self._build_stale_release_update(job)
        new_status = update_data["status"]

        self._client.table(self.TABLE_NAME).update(update_data).eq("id", job.job_id).execute()
        logger.warning("Released stale lock: job_id=%s, new_status=%s", job.job_id, new_status)
        return True

    def _build_stale_release_update(self, job: StaleJobInfo) -> dict[str, str | None]:
        base_data: dict[str, str | None] = {
            "locked_at": None,
            "locked_by": None,
        }

        if job.has_exceeded_attempts:
            base_data["status"] = JobStatus.FAILED.value
            base_data["error_message"] = "Job timed out after max attempts"
            base_data["finished_at"] = _now_utc().isoformat()
        else:
            retry_at = _now_utc() + timedelta(minutes=_calculate_backoff_minutes(job.attempt_count))
            base_data["status"] = JobStatus.QUEUED.value
            base_data["next_attempt_at"] = retry_at.isoformat()
            base_data["error_message"] = "Lock timed out, requeued for retry"

        return base_data

    def get_job_by_id(self, job_id: UUID, user_id: UUID | None = None) -> TranscriptionJob | None:
        try:
            query = self._client.table(self.TABLE_NAME).select("*").eq("id", str(job_id))

            if user_id:
                query = query.eq("user_id", str(user_id))

            result = query.single().execute()
            return _row_to_job(result.data) if result.data else None

        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error getting job: %s", error)
            return None

    def get_jobs_by_user(self, user_id: UUID, limit: int = 20, offset: int = 0) -> list[TranscriptionJob]:
        try:
            result = (
                self._client.table(self.TABLE_NAME)
                .select("*")
                .eq("user_id", str(user_id))
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )

            return [_row_to_job(row) for row in (result.data or [])]

        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error getting jobs for user: %s", error)
            return []

    def cancel_job(self, job_id: UUID, user_id: UUID) -> bool:
        try:
            result = (
                self._client.table(self.TABLE_NAME)
                .update({
                    "status": JobStatus.CANCELLED.value,
                    "finished_at": _now_utc().isoformat(),
                })
                .eq("id", str(job_id))
                .eq("user_id", str(user_id))
                .eq("status", JobStatus.QUEUED.value)
                .execute()
            )

            if result.data:
                logger.info("Job cancelled: id=%s, user=%s", job_id, user_id)
                return True
            return False

        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error cancelling job: %s", error)
            return False

    def update_job_progress(
        self,
        job_id: UUID,
        stage: str | None = None,
        progress: float | None = None,
        last_heartbeat_at: datetime | None = None,
    ) -> bool:
        update_data: dict[str, str | float] = {}

        if stage is not None:
            update_data["stage"] = stage

        if progress is not None:
            update_data["progress"] = progress

        if last_heartbeat_at is not None:
            update_data["last_heartbeat_at"] = last_heartbeat_at.isoformat()

        if not update_data:
            return True

        try:
            result = self._client.table(self.TABLE_NAME).update(update_data).eq("id", str(job_id)).execute()
            return bool(result.data)
        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error updating job progress: %s", error)
            return False


class SupabaseQuotaRepository(QuotaRepository):
    TABLE_NAME = "usage_daily"

    def __init__(self, client: Client | None = None):
        self._client = client or _create_supabase_client()

    def check_and_reserve_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        daily_limit: int = 60,
    ) -> QuotaCheck:
        try:
            result = self._client.rpc(
                "check_and_reserve_quota",
                {
                    "p_user_id": str(user_id),
                    "p_date": _get_today(),
                    "p_minutes_to_reserve": estimated_minutes,
                    "p_daily_limit": daily_limit,
                }
            ).execute()

            return self._parse_quota_result(result.data, daily_limit)

        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error checking quota: %s", error)
            return self._default_quota_check(daily_limit, "Quota check failed, allowing by default")

    def _parse_quota_result(self, data: list | dict | None, daily_limit: int) -> QuotaCheck:
        if not data:
            logger.warning("Quota check RPC failed, allowing by default")
            return self._default_quota_check(daily_limit)

        parsed = data[0] if isinstance(data, list) else data
        return QuotaCheck(
            allowed=bool(parsed.get("allowed", False)),
            minutes_remaining=int(parsed.get("minutes_remaining", 0)),
            daily_limit=daily_limit,
            reason=parsed.get("reason"),
        )

    def _default_quota_check(self, daily_limit: int, reason: str | None = None) -> QuotaCheck:
        return QuotaCheck(
            allowed=True,
            minutes_remaining=daily_limit,
            daily_limit=daily_limit,
            reason=reason,
        )

    def confirm_actual_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        actual_minutes: int,
    ) -> None:
        diff = actual_minutes - estimated_minutes
        if diff == 0:
            return

        try:
            self._client.rpc(
                "adjust_quota_usage",
                {
                    "p_user_id": str(user_id),
                    "p_date": _get_today(),
                    "p_minutes_delta": diff,
                }
            ).execute()

            logger.debug(
                "Adjusted quota: user=%s, estimated=%d, actual=%d, diff=%d",
                user_id, estimated_minutes, actual_minutes, diff,
            )

        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error adjusting quota: %s", error)

    def get_daily_usage(self, user_id: UUID) -> UsageDaily:
        today = _get_today()

        try:
            result = (
                self._client.table(self.TABLE_NAME)
                .select("*")
                .eq("user_id", str(user_id))
                .eq("date", today)
                .single()
                .execute()
            )

            return self._parse_usage_result(result.data, user_id, today)

        except (ConnectionError, TimeoutError) as error:
            logger.error("Network error getting daily usage: %s", error)
            return self._empty_usage(user_id, today)

    def _parse_usage_result(self, data: dict | None, user_id: UUID, today: str) -> UsageDaily:
        if not data:
            return self._empty_usage(user_id, today)

        return UsageDaily(
            user_id=user_id,
            date=today,
            minutes_used=int(data.get("minutes_used", 0)),
            jobs_count=int(data.get("jobs_count", 0)),
            updated_at=_parse_datetime(data.get("updated_at")),
        )

    def _empty_usage(self, user_id: UUID, today: str) -> UsageDaily:
        return UsageDaily(user_id=user_id, date=today, minutes_used=0, jobs_count=0)
