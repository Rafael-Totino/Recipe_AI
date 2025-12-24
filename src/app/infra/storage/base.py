from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path


class StorageProvider(ABC):
    @abstractmethod
    def generate_signed_put_url(
        self,
        object_key: str,
        content_type: str,
        expires_seconds: int = 3600,
    ) -> tuple[str, datetime]:
        pass

    @abstractmethod
    def generate_signed_get_url(
        self,
        object_key: str,
        expires_seconds: int = 3600,
    ) -> str:
        pass

    @abstractmethod
    def download_to_path(
        self,
        object_key: str,
        target_path: Path,
    ) -> Path:
        pass

    @abstractmethod
    def delete_object(self, object_key: str) -> bool:
        pass

    @abstractmethod
    def object_exists(self, object_key: str) -> bool:
        pass

    @abstractmethod
    def get_object_metadata(self, object_key: str) -> dict[str, object]:
        pass

    def generate_object_key(
        self,
        user_id: str,
        filename: str,
        prefix: str = "media",
    ) -> str:
        from datetime import datetime
        from uuid import uuid4
        import re

        now = datetime.utcnow()
        year = now.strftime("%Y")
        month = now.strftime("%m")

        safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
        unique_id = uuid4().hex[:8]

        return f"users/{user_id}/{prefix}/{year}/{month}/{unique_id}_{safe_filename}"
