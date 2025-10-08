# src/app/main.py
from __future__ import annotations
import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.app.config import settings
from src.app.routers.ingest import router as ingest_router
from src.app.routers.auth import router as auth_router
from src.app.routers.chat import router as chat_router
from src.app.routers.playlists import router as playlists_router

# Logging simples no stdout (bom para dev e containers)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

app = FastAPI(title="Recipes AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(playlists_router)


@app.get("/health")
def health():
    return {"ok": True}
