from __future__ import annotations

import logging
import os
from uuid import UUID

from src.app.domain.errors import QuotaExceededError
from src.app.domain.models import QuotaCheck, UsageDaily
from src.app.infra.db.base import QuotaRepository
from src.app.infra.db.supabase_jobs_repo import SupabaseQuotaRepository

logger = logging.getLogger(__name__)

DEFAULT_DAILY_LIMIT_MINUTES = int(os.getenv("TRANSCRIPTION_DAILY_LIMIT_MINUTES", "60"))


class QuotaService:
    def __init__(
        self,
        repository: QuotaRepository | None = None,
        daily_limit: int = DEFAULT_DAILY_LIMIT_MINUTES,
    ):
        self._repo = repository or SupabaseQuotaRepository()
        self.daily_limit = daily_limit

    def check_quota(
        self,
        user_id: UUID,
        estimated_minutes: int,
    ) -> QuotaCheck:
        return self._repo.check_and_reserve_minutes(
            user_id=user_id,
            estimated_minutes=estimated_minutes,
            daily_limit=self.daily_limit,
        )

    def reserve_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
    ) -> QuotaCheck:
        result = self.check_quota(user_id, estimated_minutes)

        if not result.allowed:
            raise QuotaExceededError(
                message=result.reason or "Daily quota exceeded",
                minutes_remaining=result.minutes_remaining,
            )

        return result

    def confirm_usage(
        self,
        user_id: UUID,
        estimated_minutes: int,
        actual_minutes: int,
    ) -> None:
        self._repo.confirm_actual_minutes(
            user_id=user_id,
            estimated_minutes=estimated_minutes,
            actual_minutes=actual_minutes,
        )

        logger.info(
            "Quota reconciled: user=%s, estimated=%d, actual=%d",
            user_id,
            estimated_minutes,
            actual_minutes,
        )

    def get_usage(self, user_id: UUID) -> UsageDaily:
        return self._repo.get_daily_usage(user_id)

    def get_remaining_minutes(self, user_id: UUID) -> int:
        usage = self.get_usage(user_id)
        return max(0, self.daily_limit - usage.minutes_used)
