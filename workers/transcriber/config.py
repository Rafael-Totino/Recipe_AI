from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class WorkerConfig:
    worker_id: str = os.getenv("WORKER_ID", f"worker-{os.getpid()}")
    poll_interval_seconds: int = int(os.getenv("WORKER_POLL_INTERVAL", "5"))
    max_poll_interval_seconds: int = int(os.getenv("WORKER_MAX_POLL_INTERVAL", "30"))
    max_jobs_per_run: int = int(os.getenv("WORKER_MAX_JOBS_PER_RUN", "0"))
    shutdown_on_empty: bool = os.getenv("WORKER_SHUTDOWN_ON_EMPTY", "false").lower() == "true"
    empty_queue_shutdown_minutes: int = int(os.getenv("WORKER_EMPTY_SHUTDOWN_MINUTES", "10"))
    lock_ttl_minutes: int = int(os.getenv("WORKER_LOCK_TTL_MINUTES", "30"))
    stale_lock_check_interval_minutes: int = int(os.getenv("WORKER_STALE_CHECK_MINUTES", "5"))
    temp_dir: str = os.getenv("WORKER_TEMP_DIR", "/tmp/transcription-worker")
    default_language: str = os.getenv("TRANSCRIPTION_LANGUAGE", "pt")
    graceful_shutdown_timeout_seconds: int = int(os.getenv("WORKER_SHUTDOWN_TIMEOUT", "300"))
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    r2_account_id: str = os.getenv("R2_ACCOUNT_ID", "")
    r2_access_key_id: str = os.getenv("R2_ACCESS_KEY_ID", "")
    r2_secret_access_key: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    r2_bucket_name: str = os.getenv("R2_BUCKET_NAME", "")

    def validate(self) -> list[str]:
        errors: list[str] = []

        if not self.supabase_url:
            errors.append("SUPABASE_URL is required")

        if not self.supabase_key:
            errors.append("SUPABASE_SERVICE_ROLE_KEY is required")

        if not self.r2_account_id:
            errors.append("R2_ACCOUNT_ID is required")

        if not self.r2_access_key_id:
            errors.append("R2_ACCESS_KEY_ID is required")

        if not self.r2_secret_access_key:
            errors.append("R2_SECRET_ACCESS_KEY is required")

        if not self.r2_bucket_name:
            errors.append("R2_BUCKET_NAME is required")

        return errors


def get_config() -> WorkerConfig:
    return WorkerConfig()
