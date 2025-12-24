# src/app/services/quota_service.py
"""
Quota management service.
Handles daily usage limits for transcription.
"""
from __future__ import annotations

import logging
import os
from typing import Optional
from uuid import UUID

from src.app.domain.errors import QuotaExceededError
from src.app.domain.models import QuotaCheck, UsageDaily
from src.app.infra.db.base import QuotaRepository
from src.app.infra.db.supabase_jobs_repo import SupabaseQuotaRepository

logger = logging.getLogger(__name__)

# Default daily limit in minutes (can be overridden per user tier)
DEFAULT_DAILY_LIMIT_MINUTES = int(os.getenv("TRANSCRIPTION_DAILY_LIMIT_MINUTES", "60"))


class QuotaService:
    """
    Service for managing transcription quotas.
    
    Responsibilities:
    - Check if user can create new jobs
    - Reserve minutes when job is created
    - Reconcile after job completion
    - Provide usage statistics
    """
    
    def __init__(
        self,
        repository: Optional[QuotaRepository] = None,
        daily_limit: int = DEFAULT_DAILY_LIMIT_MINUTES,
    ):
        self._repo = repository or SupabaseQuotaRepository()
        self.daily_limit = daily_limit
    
    def check_quota(
        self,
        user_id: UUID,
        estimated_minutes: int,
    ) -> QuotaCheck:
        """
        Check if user has enough quota for a job.
        
        Args:
            user_id: The user to check
            estimated_minutes: Estimated duration in minutes
            
        Returns:
            QuotaCheck with result
        """
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
        """
        Reserve minutes for a job (same as check_quota but always reserves).
        
        Args:
            user_id: The user
            estimated_minutes: Minutes to reserve
            
        Returns:
            QuotaCheck with result
            
        Raises:
            QuotaExceededError: If quota exceeded
        """
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
        """
        Reconcile estimated vs actual usage after job completion.
        
        If actual < estimated, returns unused quota to the user.
        If actual > estimated, adds the difference.
        
        Args:
            user_id: The user
            estimated_minutes: Originally reserved
            actual_minutes: Actually used
        """
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
        """
        Get today's usage for a user.
        
        Args:
            user_id: The user
            
        Returns:
            UsageDaily with current usage
        """
        return self._repo.get_daily_usage(user_id)
    
    def get_remaining_minutes(self, user_id: UUID) -> int:
        """
        Get remaining minutes for today.
        
        Args:
            user_id: The user
            
        Returns:
            Remaining minutes
        """
        usage = self.get_usage(user_id)
        return max(0, self.daily_limit - usage.minutes_used)
