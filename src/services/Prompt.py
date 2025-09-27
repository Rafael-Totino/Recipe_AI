from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict
from dotenv import load_dotenv, find_dotenv

from google import genai
from google.genai import types
from google.genai.errors import ClientError
from src.services.errors import RateLimitedError
from src.services.gemini_client import *

SYSTEM_PROMPT = Path('data/Prompt/SYSTEM_PROMPT.txt')
_MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

def get_api_key(key: str) -> str:
    env_path = find_dotenv()
    
    if not env_path:
        raise FileNotFoundError("Arquivo .env não encontrado. Verifique se ele existe na raiz do projeto.")
        
    load_dotenv(dotenv_path=env_path)
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise ValueError(f"A chave da API do Google não foi encontrada. Verifique se o arquivo {env_path} existe e está configurado corretamente.")

    return api_key

def run_recipe_agent(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not payload:
        raise ValueError("Payload cannot be empty.")

    try:
        client = GeminiClient(api_key=get_api_key("GEMINI_API_KEY"), model_name="gemini-2.5-flash")
        
        response = client.generate_content(
            user_prompt=payload,
            system_prompt_path=SYSTEM_PROMPT
        )
        
    except ClientError as err:
        status_code = getattr(err, "status_code", None)
        message = str(err)
        if status_code == 429 or "RESOURCE_EXHAUSTED" in message:
            raise RateLimitedError(
                "Limite da API do Gemini atingido. Tente novamente em alguns instantes."
            ) from err
        raise

    
    if not response:
        raise RuntimeError("Model response did not include text content.")

