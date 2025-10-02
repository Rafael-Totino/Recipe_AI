from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    id: str
    role: Literal["user", "assistant", "system"]
    content: str
    createdAt: datetime
    chatId: str
    relatedRecipeIds: Optional[list[str]] = None
    suggestions: Optional[list[dict[str, str]]] = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    recipeId: Optional[str] = None
    threadId: Optional[str] = None
    chatId: Optional[str] = None


class ChatResponse(BaseModel):
    message: ChatMessage
    userMessage: ChatMessage

