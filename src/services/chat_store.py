from __future__ import annotations

import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional

from src.services.chat_agent import run_chat_agent

_MAX_HISTORY = 20
_history: Dict[str, Deque[Dict[str, Any]]] = defaultdict(lambda: deque(maxlen=_MAX_HISTORY))


def _build_message(
    role: str,
    content: str,
    related_recipe_id: Optional[str] = None,
    message_id: Optional[str] = None,
) -> Dict[str, Any]:
    entry: Dict[str, Any] = {
        "id": message_id or str(uuid.uuid4()),
        "role": role,
        "content": content,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    if related_recipe_id:
        entry["relatedRecipeIds"] = [related_recipe_id]
    return entry


def list_messages(user_id: str) -> List[Dict[str, Any]]:
    return list(_history[user_id])


def send_message(
    user_id: str,
    message: str,
    recipe_id: Optional[str] = None,
    client_message_id: Optional[str] = None,
) -> Dict[str, Any]:
    user_entry = _build_message("user", message, recipe_id, client_message_id)
    _history[user_id].append(user_entry)

    history_payload = [{"role": item["role"], "content": item["content"]} for item in _history[user_id]]
    assistant_text = run_chat_agent(history_payload, message)

    assistant_entry = _build_message("assistant", assistant_text)
    _history[user_id].append(assistant_entry)

    return assistant_entry
