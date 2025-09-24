# src/app/config.py
from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyUrl

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")
    SUPABASE_URL: AnyUrl
    SUPABASE_SERVICE_ROLE_KEY: str
    APP_ENV: str = "local"

settings = Settings()
