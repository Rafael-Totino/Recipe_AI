from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Union

import google.generativeai as genai


class GeminiClient:
    """Minimal wrapper around Google Gemini."""

    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash") -> None:
        self.api_key = api_key
        self.model_name = model_name
        self._configure_api()

    def _configure_api(self) -> None:
        if not self.api_key:
            raise ValueError("Missing Google API key.")
        genai.configure(api_key=self.api_key)

    def _load_system_prompt(self, file_path: Path) -> str:
        try:
            return file_path.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise FileNotFoundError(f"Prompt file not found: {file_path}") from exc
        except Exception as exc:  # noqa: BLE001
            raise IOError(f"Unable to read prompt file: {exc}") from exc

    def _serialize_prompt(self, user_prompt: Any) -> str:
        if isinstance(user_prompt, str):
            return user_prompt
        try:
            return json.dumps(user_prompt, indent=2, ensure_ascii=False)
        except TypeError:
            return str(user_prompt)

    def generate_content(self, user_prompt: Union[Dict[str, Any], str], system_prompt_path: Path) -> str:
        system_instruction = self._load_system_prompt(system_prompt_path)
        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_instruction,
        )

        payload = self._serialize_prompt(user_prompt)
        response = model.generate_content(payload)
        return response.text
