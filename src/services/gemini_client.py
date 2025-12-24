from __future__ import annotations

import json
from pathlib import Path

import google.generativeai as genai

from src.services.errors import ServiceError


class GeminiConfigurationError(ServiceError):
    pass


class GeminiPromptError(ServiceError):
    pass


class GeminiClient:
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash") -> None:
        self.api_key = api_key
        self.model_name = model_name
        self._configure_api()

    def _configure_api(self) -> None:
        if not self.api_key:
            raise GeminiConfigurationError("Missing Google API key.")
        genai.configure(api_key=self.api_key)

    def _load_system_prompt(self, file_path: Path) -> str:
        try:
            return file_path.read_text(encoding="utf-8")
        except FileNotFoundError as not_found_error:
            raise GeminiPromptError(f"Prompt file not found: {file_path}") from not_found_error
        except (OSError, IOError) as io_error:
            raise GeminiPromptError(f"Unable to read prompt file: {io_error}") from io_error

    def _serialize_prompt(self, user_prompt: str | dict[str, str | int | float | list | dict]) -> str:
        if isinstance(user_prompt, str):
            return user_prompt
        try:
            return json.dumps(user_prompt, indent=2, ensure_ascii=False)
        except TypeError:
            return str(user_prompt)

    def generate_content(
        self,
        user_prompt: str | dict[str, str | int | float | list | dict],
        system_prompt_path: Path,
    ) -> str:
        system_instruction = self._load_system_prompt(system_prompt_path)
        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_instruction,
        )

        payload = self._serialize_prompt(user_prompt)
        response = model.generate_content(payload)
        return response.text
