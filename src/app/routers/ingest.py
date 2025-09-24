# src/app/api/routers/ingest.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

# 👉 a rota conversa com “caixas pretas” (serviços):
from src.services.ingest import ingest as run_ingest          # fetch + whisper
from src.app.deps import get_supabase                         # client supabase (service_role)
from src.services.persist_supabase import upsert_recipe_minimal  # salva no DB

router = APIRouter(prefix="/ingest", tags=["ingest"])

class IngestRequest(BaseModel):
    url: HttpUrl
    owner_id: str  # (no MVP vem do frontend; em prod, tiramos do JWT)

class IngestResponse(BaseModel):
    recipe_id: str
    title: str
    has_caption: bool
    has_transcript: bool

@router.post("", response_model=IngestResponse)
def ingest_endpoint(body: IngestRequest):
    try:
        content = run_ingest(str(body.url))               # 1) coletar+transcrever
        supa = get_supabase()                             # 2) dependência externa
        recipe_id = upsert_recipe_minimal(supa,           # 3) persistir
                                          owner_id=body.owner_id,
                                          content=content)
        return IngestResponse(                            # 4) resposta mínima útil
            recipe_id=recipe_id,
            title=content.title or "Sem título",
            has_caption=bool(content.caption),
            has_transcript=bool(content.transcript),
        )
    except Exception as e:
        # 5) a rota não vaza internals (logar detalhado no servidor)
        raise HTTPException(status_code=500, detail="Falha na ingestão")
