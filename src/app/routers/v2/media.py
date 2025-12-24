from __future__ import annotations

import logging
import os
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from src.app.deps import get_current_user, CurrentUser
from src.app.infra.storage.r2_provider import R2StorageProvider
from src.app.domain.errors import StorageError, StorageDownloadError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v2/media", tags=["Media V2"])

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

MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024


class SignedUploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field(...)
    size_bytes: int | None = Field(None, ge=1, le=MAX_FILE_SIZE_BYTES)


class SignedUploadResponse(BaseModel):
    object_key: str = Field(...)
    upload_url: str = Field(...)
    expires_at: datetime = Field(...)
    max_size_bytes: int = Field(default=MAX_FILE_SIZE_BYTES)


def _sanitize_filename(filename: str) -> str:
    filename = os.path.basename(filename)
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    if len(filename) > 100:
        name, ext = os.path.splitext(filename)
        filename = name[:95] + ext
    return filename


def _get_storage() -> R2StorageProvider:
    try:
        return R2StorageProvider()
    except StorageError as storage_error:
        logger.error("Failed to initialize storage: %s", storage_error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage service unavailable",
        )


@router.post("/signed-upload", response_model=SignedUploadResponse)
async def create_signed_upload(
    request: SignedUploadRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> SignedUploadResponse:
    user_id = current_user.id

    if request.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content type '{request.content_type}' not allowed. Allowed types: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}",
        )

    if request.size_bytes and request.size_bytes > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE_BYTES // (1024*1024)}MB",
        )

    storage = _get_storage()

    safe_filename = _sanitize_filename(request.filename)
    object_key = storage.generate_object_key(
        user_id=user_id,
        filename=safe_filename,
        prefix="media",
    )

    try:
        upload_url, expires_at = storage.generate_signed_put_url(
            object_key=object_key,
            content_type=request.content_type,
            expires_seconds=3600,
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

    except StorageError as storage_error:
        logger.error("Failed to generate signed URL: %s", storage_error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to generate upload URL",
        )


class VerifyUploadRequest(BaseModel):
    object_key: str = Field(...)


class VerifyUploadResponse(BaseModel):
    exists: bool = Field(...)
    size_bytes: int | None = Field(None)
    content_type: str | None = Field(None)


@router.post("/verify-upload", response_model=VerifyUploadResponse)
async def verify_upload(
    request: VerifyUploadRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> VerifyUploadResponse:
    user_id = current_user.id

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

    except (StorageError, StorageDownloadError) as storage_error:
        logger.error("Failed to verify upload: %s", storage_error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to verify upload",
        )
