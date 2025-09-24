from __future__ import annotations
from fastapi import APIRouter, Depends
from src.app.deps import get_current_user, CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/me", response_model=CurrentUser)
async def me(user: CurrentUser = Depends(get_current_user)):
    return user
