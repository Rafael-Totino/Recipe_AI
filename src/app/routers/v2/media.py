# src/app/routers/v2/media.py
"""
Media upload routes using signed URLs for direct R2 upload.
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from src.app.deps import get_current_user, CurrentUser
from src.app.infra.storage.r2_provider import R2StorageProvider
from src.app.domain.errors import StorageError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v2/media", tags=["Media V2"])


# Allowed content types for upload
ALLOWED_CONTENT_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "audio/webm",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "video/mp4",
    "video/webm",
    "video/quicktime",
}

# Max file size (500MB)
MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024


class SignedUploadRequest(BaseModel):
    """Request for a signed upload URL."""
    filename: str = Field(..., min_length=1, max_length=255, description="Original filename")
    content_type: str = Field(..., description="MIME type of the file")
    size_bytes: Optional[int] = Field(None, ge=1, le=MAX_FILE_SIZE_BYTES, description="File size in bytes")


class SignedUploadResponse(BaseModel):
    """Response with signed upload URL."""
    object_key: str = Field(..., description="The storage key for the uploaded file")
    upload_url: str = Field(..., description="Pre-signed PUT URL for direct upload")
    expires_at: datetime = Field(..., description="When the upload URL expires")
    max_size_bytes: int = Field(default=MAX_FILE_SIZE_BYTES, description="Maximum allowed file size")


def _sanitize_filename(filename: str) -> str:
    """Sanitize filename for storage."""
    # Remove path components
    filename = os.path.basename(filename)
    # Replace unsafe characters
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    # Limit length
    if len(filename) > 100:
        name, ext = os.path.splitext(filename)
        filename = name[:95] + ext
    return filename


def _get_storage() -> R2StorageProvider:
    """Get storage provider instance."""
    try:
        return R2StorageProvider()
    except StorageError as e:
        logger.error("Failed to initialize storage: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage service unavailable",
        )


@router.post("/signed-upload", response_model=SignedUploadResponse)
async def create_signed_upload(
    request: SignedUploadRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    user_id = current_user.id
    """
    Generate a pre-signed URL for direct upload to R2.
    
    The client should:
    1. Call this endpoint to get the signed URL
    2. PUT the file directly to the upload_url with the specified content_type
    3. Create a transcription job with the returned object_key
    
    The signed URL is valid for 1 hour.
    """
    # Validate content type
    if request.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content type '{request.content_type}' not allowed. Allowed types: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}",
        )
    
    # Validate file size if provided
    if request.size_bytes and request.size_bytes > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE_BYTES // (1024*1024)}MB",
        )
    
    storage = _get_storage()
    
    # Generate object key
    safe_filename = _sanitize_filename(request.filename)
    object_key = storage.generate_object_key(
        user_id=user_id,
        filename=safe_filename,
        prefix="media",
    )
    
    try:
        # Generate signed PUT URL
        upload_url, expires_at = storage.generate_signed_put_url(
            object_key=object_key,
            content_type=request.content_type,
            expires_seconds=3600,  # 1 hour
        )
        
        logger.info(
            "Generated signed upload URL: user=%s, object_key=%s, content_type=%s",
            user_id,
            object_key,
            request.content_type,
        )
        
        return SignedUploadResponse(
            object_key=object_key,
            upload_url=upload_url,
            expires_at=expires_at,
            max_size_bytes=MAX_FILE_SIZE_BYTES,
        )
        
    except StorageError as e:
        logger.error("Failed to generate signed URL: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to generate upload URL",
        )


class VerifyUploadRequest(BaseModel):
    """Request to verify an upload completed successfully."""
    object_key: str = Field(..., description="The object key from signed-upload response")


class VerifyUploadResponse(BaseModel):
    """Response from upload verification."""
    exists: bool = Field(..., description="Whether the file exists in storage")
    size_bytes: Optional[int] = Field(None, description="File size if exists")
    content_type: Optional[str] = Field(None, description="Content type if exists")


@router.post("/verify-upload", response_model=VerifyUploadResponse)
async def verify_upload(
    request: VerifyUploadRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    user_id = current_user.id
    """
    Verify that an upload completed successfully.
    
    This is optional - the client can proceed directly to creating a job.
    Useful for confirming upload before job creation.
    """
    # Validate that the object key belongs to this user
    if not request.object_key.startswith(f"users/{user_id}/"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Object key does not belong to this user",
        )
    
    storage = _get_storage()
    
    try:
        if not storage.object_exists(request.object_key):
            return VerifyUploadResponse(exists=False)
        
        metadata = storage.get_object_metadata(request.object_key)
        
        return VerifyUploadResponse(
            exists=True,
            size_bytes=metadata.get("content_length"),
            content_type=metadata.get("content_type"),
        )
        
    except StorageError as e:
        logger.error("Failed to verify upload: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to verify upload",
        )
