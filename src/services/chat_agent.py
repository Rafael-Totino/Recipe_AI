from __future__ import annotations

from pathlib import Path
from typing import Iterable, Mapping

from src.app.config import settings
from src.services.gemini_client import GeminiClient

CHAT_SYSTEM_PROMPT = Path("data/Prompt/CHAT_SYSTEM_PROMPT.txt")
_MODEL_NAME = "gemini-2.5-flash"


def run_chat_agent(
    history: Iterable[Mapping[str, str]],
    user_message: str,
    context: str | None = None,
) -> str:
    client = GeminiClient(api_key=settings.GEMINI_API_KEY.get_secret_value(), model_name=_MODEL_NAME)

    prompt_sections: list[str] = []

    cleaned_context = context.strip() if context else ""
    if cleaned_context:
        prompt_sections.append(
            "Contexto recuperado das receitas do usuário:\n"
            f"{cleaned_context}"
        )

    formatted_history: list[str] = []
    for item in history:
        role = (item.get("role") or "").strip().lower()
        content = (item.get("content") or "").strip()
        if not content:
            continue
        if role == "assistant":
            speaker = "Assistente"
        elif role == "user":
            speaker = "Usuário"
        else:
            speaker = role.capitalize() or "Mensagem"
        formatted_history.append(f"{speaker}: {content}")

    if formatted_history:
        prompt_sections.append(
            "Histórico recente do chat (mais antigo primeiro):\n"
            + "\n".join(formatted_history)
        )

    prompt_sections.append(
        "Pergunta atual do usuário:\n"
        f"{user_message.strip()}"
    )

    payload = "\n\n".join(section for section in prompt_sections if section)
    response = client.generate_content(payload, CHAT_SYSTEM_PROMPT)
    return response.strip()
