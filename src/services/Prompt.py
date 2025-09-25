import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

from google import genai
from google.genai import types

# Ensure GEMINI_API_KEY from project .env is loaded when running standalone scripts
if not os.getenv("GEMINI_API_KEY"):
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if not line or line.strip().startswith("#"):
                continue
            key, _, value = line.partition("=")
            if key == "GEMINI_API_KEY" and value:
                os.environ.setdefault(key, value.strip())
                break

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("Missing GEMINI_API_KEY environment variable.")

client = genai.Client(api_key=api_key)

def build_recipe_payload(raw_input: Dict[str, Any]) -> Dict[str, Any]:
    response = client.models.generate_content(
        model="gemini-2.0-pro-exp-02-05",
        system_instruction=types.Content(
            role="system",
            parts=[types.Part(text=os.getenv("SYSTEM_PROMPT"))]
        ),
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part(
                        text="Transforme o texto abaixo em receita estruturada no formato combinado."
                    ),
                    types.Part(json=raw_input),
                ],
            ),
        ],
        config=types.GenerateContentConfig(
            temperature=0.1,
            candidate_count=1,
            max_output_tokens=2048,
        ),
    )

    candidate = response.candidates[0]
    part = candidate.content.parts[0]

    if hasattr(part, "text") and part.text:
        return json.loads(part.text)
    return part.as_dict()

if __name__ == "__main__":
    example_payload = {
        "platform": "youtube",
        "videoTitle": "Bolo de Cenoura Perfeito",
        "videoAuthor": "Canal da Maria",
        "sourceUrl": "https://www.youtube.com/watch?v=XYZ",
        "thumbnailUrl": "https://img.youtube.com/vi/XYZ/0.jpg",
        "captions": None,
        "transcript": "transcrição completa do vídeo aqui...",
    }

    recipe_json = build_recipe_payload(example_payload)
    print(json.dumps(recipe_json, ensure_ascii=False, indent=2))
