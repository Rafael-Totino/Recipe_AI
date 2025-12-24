# src/app/infra/storage/base.py
"""
Abstract base class for storage providers.
This interface allows easy swapping between different storage backends (R2, S3, GCS, etc.)
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Optional


class StorageProvider(ABC):
    """
    Abstract interface for object storage operations.
    
    Implementations:
    - R2StorageProvider: Cloudflare R2 (S3-compatible)
    - Future: S3Provider, GCSProvider, LocalProvider (for testing)
    """
    
    @abstractmethod
    def generate_signed_put_url(
        self,
        object_key: str,
        content_type: str,
        expires_seconds: int = 3600,
    ) -> tuple[str, datetime]:
        """
        Generate a pre-signed URL for uploading an object.
        
        Args:
            object_key: The key/path where the object will be stored
            content_type: MIME type of the content (e.g., "audio/mpeg")
            expires_seconds: URL validity in seconds
            
        Returns:
            Tuple of (signed_url, expiration_datetime)
        """
        pass
    
    @abstractmethod
    def generate_signed_get_url(
        self,
        object_key: str,
        expires_seconds: int = 3600,
    ) -> str:
        """
        Generate a pre-signed URL for downloading an object.
        
        Args:
            object_key: The key/path of the object
            expires_seconds: URL validity in seconds
            
        Returns:
            The signed URL for downloading
        """
        pass
    
    @abstractmethod
    def download_to_path(
        self,
        object_key: str,
        target_path: Path,
    ) -> Path:
        """
        Download an object to a local file path.
        
        Args:
            object_key: The key/path of the object in storage
            target_path: Local path where to save the file
            
        Returns:
            The path where the file was saved
        """
        pass
    
    @abstractmethod
    def delete_object(self, object_key: str) -> bool:
        """
        Delete an object from storage.
        
        Args:
            object_key: The key/path of the object to delete
            
        Returns:
            True if deletion was successful
        """
        pass
    
    @abstractmethod
    def object_exists(self, object_key: str) -> bool:
        """
        Check if an object exists in storage.
        
        Args:
            object_key: The key/path of the object
            
        Returns:
            True if the object exists
        """
        pass
    
    def generate_object_key(
        self,
        user_id: str,
        filename: str,
        prefix: str = "media",
    ) -> str:
        """
        Generate a standardized object key for storing media.
        
        Format: users/{user_id}/{prefix}/{YYYY}/{MM}/{uuid}_{filename}
        
        Args:
            user_id: The user's UUID
            filename: Original filename
            prefix: Path prefix (default: "media")
            
        Returns:
            The generated object key
        """
        from datetime import datetime
        from uuid import uuid4
        import re
        
        now = datetime.utcnow()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        
        # Sanitize filename
        safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
        unique_id = uuid4().hex[:8]
        
        return f"users/{user_id}/{prefix}/{year}/{month}/{unique_id}_{safe_filename}"
