# src/app/schemas/ingest.py
from uuid import UUID

from pydantic import BaseModel, HttpUrl


class IngestRequest(BaseModel):
    url: HttpUrl
    owner_id: UUID  # UUID do auth.users


class IngestResponse(BaseModel):
    recipe_id: str
    title: str
    has_caption: bool
    has_transcript: bool
