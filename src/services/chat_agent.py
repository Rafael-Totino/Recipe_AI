from __future__ import annotations

from pathlib import Path
from typing import Iterable, Mapping

from src.services.Prompt import get_api_key
from src.services.gemini_client import GeminiClient

CHAT_SYSTEM_PROMPT = Path("data/Prompt/CHAT_SYSTEM_PROMPT.txt")
_MODEL_NAME = "gemini-2.5-flash"


def run_chat_agent(history: Iterable[Mapping[str, str]], user_message: str) -> str:
    client = GeminiClient(api_key=get_api_key("GEMINI_API_KEY"), model_name=_MODEL_NAME)
    payload = {
        "history": list(history),
        "user_message": user_message,
    }
    response = client.generate_content(payload, CHAT_SYSTEM_PROMPT)
    return response.strip()
