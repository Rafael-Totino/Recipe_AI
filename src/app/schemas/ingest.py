from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class IngredientItem(BaseModel):
    name: str
    quantity: Optional[str] = None
    notes: Optional[str] = None


class RecipeStep(BaseModel):
    order: int
    description: str
    durationMinutes: Optional[int] = None
    tips: Optional[str] = None


class RecipeSource(BaseModel):
    link: Optional[str] = None
    importedFrom: Optional[Literal["youtube", "instagram", "tiktok", "blog", "manual"]] = None
    importedAt: Optional[str] = None


class RecipeMedia(BaseModel):
    type: Literal["image", "video", "audio"]
    url: str
    thumbnailUrl: Optional[str] = None
    provider: Optional[Literal["youtube", "instagram", "tiktok", "spotify", "generic"]] = None


class RecipeResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    isFavorite: Optional[bool] = None
    durationMinutes: Optional[int] = None
    servings: Optional[int] = None
    difficulty: Optional[Literal["easy", "medium", "hard"]] = None
    tags: list[str] = Field(default_factory=list)
    coverImage: Optional[str] = None
    ingredients: list[IngredientItem] = Field(default_factory=list)
    steps: list[RecipeStep] = Field(default_factory=list)
    notes: Optional[str] = None
    source: Optional[RecipeSource] = None
    media: list[RecipeMedia] = Field(default_factory=list)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class IngestResponse(BaseModel):
    recipe: RecipeResponse
    warnings: Optional[list[str]] = None


class IngestRequest(BaseModel):
    url: str
