# src/app/infra/storage/r2_provider.py
"""
Cloudflare R2 storage provider implementation.
R2 is S3-compatible, so we use boto3 with custom endpoint.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from src.app.domain.errors import StorageError
from src.app.infra.storage.base import StorageProvider

logger = logging.getLogger(__name__)


class R2StorageProvider(StorageProvider):
    """
    Cloudflare R2 storage provider using boto3 (S3-compatible).
    
    Environment variables required:
    - R2_ACCOUNT_ID: Cloudflare account ID
    - R2_ACCESS_KEY_ID: R2 access key ID
    - R2_SECRET_ACCESS_KEY: R2 secret access key
    - R2_BUCKET_NAME: Name of the R2 bucket
    - R2_PUBLIC_URL: (Optional) Public URL for the bucket
    """
    
    def __init__(
        self,
        account_id: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
        public_url: Optional[str] = None,
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
            region_name="auto",  # R2 uses 'auto' as region
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
        """Generate a pre-signed PUT URL for direct upload to R2."""
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
            
        except ClientError as e:
            logger.error("Failed to generate signed PUT URL: %s", e)
            raise StorageError(f"Failed to generate upload URL: {e}") from e
    
    def generate_signed_get_url(
        self,
        object_key: str,
        expires_seconds: int = 3600,
    ) -> str:
        """Generate a pre-signed GET URL for downloading from R2."""
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
            
        except ClientError as e:
            logger.error("Failed to generate signed GET URL: %s", e)
            raise StorageError(f"Failed to generate download URL: {e}") from e
    
    def download_to_path(
        self,
        object_key: str,
        target_path: Path,
    ) -> Path:
        """Download an object from R2 to a local file."""
        try:
            # Ensure parent directory exists
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
            
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if error_code == "404" or error_code == "NoSuchKey":
                raise StorageError(f"Object not found: {object_key}") from e
            logger.error("Failed to download from R2: %s", e)
            raise StorageError(f"Failed to download file: {e}") from e
    
    def delete_object(self, object_key: str) -> bool:
        """Delete an object from R2."""
        try:
            self._client.delete_object(
                Bucket=self.bucket_name,
                Key=object_key,
            )
            logger.info("Deleted object from R2: key=%s", object_key)
            return True
            
        except ClientError as e:
            logger.error("Failed to delete object from R2: %s", e)
            return False
    
    def object_exists(self, object_key: str) -> bool:
        """Check if an object exists in R2."""
        try:
            self._client.head_object(
                Bucket=self.bucket_name,
                Key=object_key,
            )
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if error_code == "404" or error_code == "NoSuchKey":
                return False
            logger.error("Error checking object existence: %s", e)
            raise StorageError(f"Failed to check object existence: {e}") from e
    
    def get_object_metadata(self, object_key: str) -> dict:
        """Get metadata for an object in R2."""
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
        except ClientError as e:
            logger.error("Failed to get object metadata: %s", e)
            raise StorageError(f"Failed to get object metadata: {e}") from e
