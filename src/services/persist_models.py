# src/services/persist_models.py
from typing import Literal, Optional

from pydantic import BaseModel, Field

Platform = Literal["youtube", "instagram"]


class RecipeRecord(BaseModel):
    owner_id: str
    slug: str
    title: str
    status: str = "published"
    version: int = 1
    metadata: dict


class RecipeSourceRecord(BaseModel):
    recipe_id: str
    platform: Platform
    platform_item_id: str
    url: str
    author_name: Optional[str] = None
    collected_at: str
    provenance: dict = Field(default_factory=dict)
