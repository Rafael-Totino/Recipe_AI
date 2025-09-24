# src/app/api/routers/ingest.py
import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool
from supabase import Client

from src.app.deps import get_supabase
from src.app.schemas.ingest import IngestRequest, IngestResponse
from src.services.ingest import ingest as run_ingest
from src.services.persist_supabase import upsert_recipe_minimal

log = logging.getLogger("ingest")
router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestResponse)
async def ingest_endpoint(
    body: IngestRequest,
    supa: Client = Depends(get_supabase),
):
    t0 = time.time()
    log.info("ingest.start url=%s owner=%s", body.url, body.owner_id)
    try:
        # offload pesado para threadpool (bloqueante e CPU/GPU-bound)
        content = await run_in_threadpool(run_ingest, str(body.url))
        recipe_id = await run_in_threadpool(
            upsert_recipe_minimal,
            supa,
            str(body.owner_id),
            content,
        )
        dt = time.time() - t0
        log.info("ingest.ok url=%s recipe=%s dt=%.2fs", body.url, recipe_id, dt)
        return IngestResponse(
            recipe_id=recipe_id,
            title=content.title or "Sem titulo",
            has_caption=bool(content.caption),
            has_transcript=bool(content.transcript),
        )
    except Exception:
        dt = time.time() - t0
        log.exception("ingest.fail url=%s dt=%.2fs", body.url, dt)
        raise HTTPException(status_code=500, detail="Falha na ingestao")
