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
# V2 routes for async transcription workflow
from src.app.routers.v2.media import router as media_v2_router
from src.app.routers.v2.transcriptions import router as transcriptions_v2_router
from src.services import embedding_queue

# Logging simples no stdout (bom para dev e containers)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

app = FastAPI(title="Recipes AI API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# V1 routes (existing)
app.include_router(ingest_router)
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(playlists_router)

# V2 routes (async transcription workflow)
app.include_router(media_v2_router)
app.include_router(transcriptions_v2_router)


@app.on_event("startup")
async def startup() -> None:
    if embedding_queue.get_queue_mode() == embedding_queue.MODE_IN_MEMORY:
        await embedding_queue.start_worker()


@app.on_event("shutdown")
async def shutdown() -> None:
    if embedding_queue.get_queue_mode() == embedding_queue.MODE_IN_MEMORY:
        await embedding_queue.stop_worker()


@app.get("/health")
def health():
    return {"ok": True}
