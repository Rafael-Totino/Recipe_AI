from __future__ import annotations

from pydantic import AnyUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8-sig",
        case_sensitive=False,
        extra="ignore",
    )

    SUPABASE_URL: AnyUrl
    SUPABASE_SERVICE_ROLE_KEY: str
    APP_ENV: str = "local"
    FRONTEND_CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: ["http://192.168.15.2:5173", "http://localhost:5173", "recipe-ai-tawny.vercel.app"],
    )


settings = Settings()
