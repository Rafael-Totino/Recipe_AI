import os
from pathlib import Path

from google import genai
from google.genai import types

# Ensure GEMINI_API_KEY from project .env is loaded when running standalone scripts
if not os.getenv("GEMINI_API_KEY"):
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
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

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Explain how AI works in a few words",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_budget=0)  # Disables thinking
    ),
)
print(response.text)
