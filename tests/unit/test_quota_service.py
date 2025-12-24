from __future__ import annotations

import pytest
from abc import ABC, abstractmethod
from uuid import UUID, uuid4

from src.app.domain.errors import QuotaExceededError
from src.app.domain.models import QuotaCheck, UsageDaily


class QuotaRepositoryProtocol(ABC):
    @abstractmethod
    def check_and_reserve_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        daily_limit: int = 60,
    ) -> QuotaCheck:
        pass

    @abstractmethod
    def confirm_actual_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        actual_minutes: int,
    ) -> None:
        pass

    @abstractmethod
    def get_daily_usage(self, user_id: UUID) -> UsageDaily:
        pass


class QuotaRepositoryStub(QuotaRepositoryProtocol):
    def __init__(self) -> None:
        self.minutes_to_return = 30
        self.allowed = True
        self.confirmed_calls: list[tuple[UUID, int, int]] = []
        self.usage_minutes = 30
        self.usage_jobs = 5

    def check_and_reserve_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        daily_limit: int = 60,
    ) -> QuotaCheck:
        return QuotaCheck(
            allowed=self.allowed,
            minutes_remaining=self.minutes_to_return,
            daily_limit=daily_limit,
            reason=None if self.allowed else "Daily quota exceeded",
        )

    def confirm_actual_minutes(
        self,
        user_id: UUID,
        estimated_minutes: int,
        actual_minutes: int,
    ) -> None:
        self.confirmed_calls.append((user_id, estimated_minutes, actual_minutes))

    def get_daily_usage(self, user_id: UUID) -> UsageDaily:
        return UsageDaily(
            user_id=user_id,
            date="2024-01-15",
            minutes_used=self.usage_minutes,
            jobs_count=self.usage_jobs,
        )


class QuotaServiceForTest:
    def __init__(
        self,
        repository: QuotaRepositoryProtocol,
        daily_limit: int = 60,
    ):
        self._repo = repository
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

    def get_usage(self, user_id: UUID) -> UsageDaily:
        return self._repo.get_daily_usage(user_id)

    def get_remaining_minutes(self, user_id: UUID) -> int:
        usage = self.get_usage(user_id)
        return max(0, self.daily_limit - usage.minutes_used)


class TestQuotaServiceCheckQuota:
    def test_check_quota_calls_repository(self) -> None:
        repo = QuotaRepositoryStub()
        service = QuotaServiceForTest(repository=repo, daily_limit=60)
        user_id = uuid4()

        result = service.check_quota(user_id, estimated_minutes=5)

        assert result.allowed is True
        assert result.minutes_remaining == 30
        assert result.daily_limit == 60


class TestQuotaServiceReserveMinutes:
    def test_reserve_minutes_success(self) -> None:
        repo = QuotaRepositoryStub()
        repo.allowed = True
        service = QuotaServiceForTest(repository=repo, daily_limit=60)
        user_id = uuid4()

        result = service.reserve_minutes(user_id, estimated_minutes=5)

        assert result.allowed is True

    def test_reserve_minutes_raises_when_exceeded(self) -> None:
        repo = QuotaRepositoryStub()
        repo.allowed = False
        repo.minutes_to_return = 0
        service = QuotaServiceForTest(repository=repo, daily_limit=60)
        user_id = uuid4()

        with pytest.raises(QuotaExceededError) as exc_info:
            service.reserve_minutes(user_id, estimated_minutes=65)

        assert exc_info.value.minutes_remaining == 0


class TestQuotaServiceConfirmUsage:
    def test_confirm_usage_calls_repository(self) -> None:
        repo = QuotaRepositoryStub()
        service = QuotaServiceForTest(repository=repo, daily_limit=60)
        user_id = uuid4()

        service.confirm_usage(user_id, estimated_minutes=5, actual_minutes=7)

        assert len(repo.confirmed_calls) == 1
        assert repo.confirmed_calls[0] == (user_id, 5, 7)


class TestQuotaServiceGetUsage:
    def test_get_usage_returns_daily_usage(self) -> None:
        repo = QuotaRepositoryStub()
        repo.usage_minutes = 45
        repo.usage_jobs = 10
        service = QuotaServiceForTest(repository=repo, daily_limit=60)
        user_id = uuid4()

        usage = service.get_usage(user_id)

        assert usage.minutes_used == 45
        assert usage.jobs_count == 10


class TestQuotaServiceGetRemainingMinutes:
    def test_get_remaining_minutes(self) -> None:
        repo = QuotaRepositoryStub()
        repo.usage_minutes = 25
        service = QuotaServiceForTest(repository=repo, daily_limit=60)
        user_id = uuid4()

        remaining = service.get_remaining_minutes(user_id)

        assert remaining == 35

    def test_get_remaining_minutes_never_negative(self) -> None:
        repo = QuotaRepositoryStub()
        repo.usage_minutes = 100
        service = QuotaServiceForTest(repository=repo, daily_limit=60)
        user_id = uuid4()

        remaining = service.get_remaining_minutes(user_id)

        assert remaining == 0
