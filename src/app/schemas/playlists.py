# src/app/schemas/playlists.py
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from src.app.schemas.ingest import RecipeResponse

PlaylistType = Literal["system", "custom"]


class PlaylistItem(BaseModel):
    recipeId: str
    recipe: RecipeResponse
    addedAt: Optional[str] = None
    position: Optional[int] = None


class PlaylistSummary(BaseModel):
    id: str
    name: str
    slug: str
    type: PlaylistType
    description: Optional[str] = None
    recipeCount: int = 0
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class PlaylistDetail(PlaylistSummary):
    items: list[PlaylistItem] = Field(default_factory=list)


class PlaylistCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)


class PlaylistUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)


class PlaylistAppendRequest(BaseModel):
    recipeId: str = Field(..., min_length=1)
