# src/app/api/routers/ingest.py
from __future__ import annotations
import time, logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

from src.app.deps import get_supabase
from src.services.ingest import ingest as run_ingest  # você já tem isso pronto
from src.services.persist_supabase import upsert_recipe_minimal

log = logging.getLogger("ingest")
router = APIRouter(prefix="/ingest", tags=["ingest"])

class IngestRequest(BaseModel):
    url: HttpUrl
    owner_id: str  # UUID de auth.users (vem do frontend logado)

class IngestResponse(BaseModel):
    recipe_id: str
    title: str
    has_caption: bool
    has_transcript: bool

@router.post("", response_model=IngestResponse)
def ingest_endpoint(body: IngestRequest):
    """
    Pensa assim:
      1) validar entrada (Pydantic já faz)
      2) orquestrar: fetch+whisper
      3) persistir no DB
      4) responder o mínimo útil pro frontend
    """
    t0 = time.time()
    log.info("ingest.start url=%s owner=%s", body.url, body.owner_id)
    try:
        content = run_ingest(str(body.url))  # 1) coleta + transcreve (caixa preta)
        supa = get_supabase()                # 2) dependência externa (singleton)
        recipe_id = upsert_recipe_minimal(
            supa, owner_id=body.owner_id, content=content
        )                                    # 3) persistência isolada
        dt = time.time() - t0
        log.info("ingest.ok url=%s recipe=%s dt=%.2fs", body.url, recipe_id, dt)
        return IngestResponse(               # 4) contrato de saída enxuto
            recipe_id=recipe_id,
            title=content.title or "Sem título",
            has_caption=bool(content.caption),
            has_transcript=bool(content.transcript),
        )
    except Exception:
        dt = time.time() - t0
        log.exception("ingest.fail url=%s dt=%.2fs", body.url, dt)
        raise HTTPException(status_code=500, detail="Falha na ingestão")
