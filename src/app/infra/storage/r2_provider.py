from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from src.app.domain.errors import StorageError, StorageDownloadError
from src.app.infra.storage.base import StorageProvider

logger = logging.getLogger(__name__)


class R2StorageProvider(StorageProvider):
    def __init__(
        self,
        account_id: str | None = None,
        access_key_id: str | None = None,
        secret_access_key: str | None = None,
        bucket_name: str | None = None,
        public_url: str | None = None,
    ):
        self.account_id = account_id or os.getenv("R2_ACCOUNT_ID")
        self.access_key_id = access_key_id or os.getenv("R2_ACCESS_KEY_ID")
        self.secret_access_key = secret_access_key or os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = bucket_name or os.getenv("R2_BUCKET_NAME")
        self.public_url = public_url or os.getenv("R2_PUBLIC_URL")

        if not all([self.account_id, self.access_key_id, self.secret_access_key, self.bucket_name]):
            raise StorageError(
                "Missing R2 configuration. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, "
                "R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
            )

        self.endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"

        self._client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            config=Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "adaptive"},
            ),
            region_name="auto",
        )

        logger.info(
            "R2StorageProvider initialized: bucket=%s, endpoint=%s",
            self.bucket_name,
            self.endpoint_url,
        )

    def generate_signed_put_url(
        self,
        object_key: str,
        content_type: str,
        expires_seconds: int = 3600,
    ) -> tuple[str, datetime]:
        try:
            url = self._client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": object_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_seconds,
            )

            expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_seconds)

            logger.debug(
                "Generated signed PUT URL: key=%s, content_type=%s, expires=%s",
                object_key,
                content_type,
                expires_at.isoformat(),
            )

            return url, expires_at

        except ClientError as client_error:
            logger.error("Failed to generate signed PUT URL: %s", client_error)
            raise StorageError(f"Failed to generate upload URL: {client_error}") from client_error

    def generate_signed_get_url(
        self,
        object_key: str,
        expires_seconds: int = 3600,
    ) -> str:
        try:
            url = self._client.generate_presigned_url(
                ClientMethod="get_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": object_key,
                },
                ExpiresIn=expires_seconds,
            )

            logger.debug("Generated signed GET URL for key=%s", object_key)
            return url

        except ClientError as client_error:
            logger.error("Failed to generate signed GET URL: %s", client_error)
            raise StorageError(f"Failed to generate download URL: {client_error}") from client_error

    def download_to_path(
        self,
        object_key: str,
        target_path: Path,
    ) -> Path:
        try:
            target_path.parent.mkdir(parents=True, exist_ok=True)

            logger.info("Downloading from R2: key=%s -> %s", object_key, target_path)

            self._client.download_file(
                Bucket=self.bucket_name,
                Key=object_key,
                Filename=str(target_path),
            )

            file_size = target_path.stat().st_size
            logger.info(
                "Downloaded successfully: key=%s, size=%d bytes",
                object_key,
                file_size,
            )

            return target_path

        except ClientError as client_error:
            error_code = client_error.response.get("Error", {}).get("Code", "Unknown")

            if error_code in ("404", "NoSuchKey"):
                raise StorageDownloadError(object_key, "Object not found") from client_error

            logger.error("Failed to download from R2: %s", client_error)
            raise StorageDownloadError(object_key, str(client_error)) from client_error

    def delete_object(self, object_key: str) -> bool:
        try:
            self._client.delete_object(
                Bucket=self.bucket_name,
                Key=object_key,
            )
            logger.info("Deleted object from R2: key=%s", object_key)
            return True

        except ClientError as client_error:
            logger.error("Failed to delete object from R2: %s", client_error)
            return False

    def object_exists(self, object_key: str) -> bool:
        try:
            self._client.head_object(
                Bucket=self.bucket_name,
                Key=object_key,
            )
            return True

        except ClientError as client_error:
            error_code = client_error.response.get("Error", {}).get("Code", "Unknown")

            if error_code in ("404", "NoSuchKey"):
                return False

            logger.error("Error checking object existence: %s", client_error)
            raise StorageError(f"Failed to check object existence: {client_error}") from client_error

    def get_object_metadata(self, object_key: str) -> dict[str, object]:
        try:
            response = self._client.head_object(
                Bucket=self.bucket_name,
                Key=object_key,
            )
            return {
                "content_type": response.get("ContentType"),
                "content_length": response.get("ContentLength"),
                "last_modified": response.get("LastModified"),
                "etag": response.get("ETag"),
            }

        except ClientError as client_error:
            logger.error("Failed to get object metadata: %s", client_error)
            raise StorageDownloadError(object_key, f"Failed to get metadata: {client_error}") from client_error
