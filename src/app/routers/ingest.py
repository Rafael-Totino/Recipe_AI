# src/app/api/routers/ingest.py
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool
from supabase import Client

from src.app.deps import CurrentUser, get_current_user, get_supabase
from src.app.schemas.ingest import (
    IngestRequest,
    IngestResponse,
    RecipeListResponse,
    RecipeMedia,
    RecipeResponse,
    RecipeSource,
)
from src.services.ingest import ingest as run_ingest
from src.services.persist_supabase import *
from src.services.types import RawContent
from src.services.errors import RateLimitedError

log = logging.getLogger("ingest")
router = APIRouter(prefix="/recipes", tags=["ingest"])

_ALLOWED_DIFFICULTIES = {"easy", "medium", "hard"}
_ALLOWED_MEDIA_TYPES = {"image", "video", "audio"}
_ALLOWED_MEDIA_PROVIDERS = {"youtube", "instagram", "tiktok", "spotify", "generic"}
_ALLOWED_SOURCE_PLATFORMS = {"youtube", "instagram", "tiktok", "blog", "manual"}


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _sanitize_tags(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        if isinstance(item, str):
            text = item.strip()
            if text:
                out.append(text)
        if len(out) == 6:
            break
    return out


def _clean_str(value: Any) -> Optional[str]:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    if isinstance(value, (int, float)):
        return str(value)
    return None


def _sanitize_ingredients(value: Any) -> List[Dict[str, Optional[str]]]:
    if not isinstance(value, list):
        return []
    items: List[Dict[str, Optional[str]]] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        name = _clean_str(entry.get("name"))
        if not name:
            continue
        quantity = _clean_str(entry.get("quantity"))
        notes = _clean_str(entry.get("notes"))
        items.append(
            {
                "name": name,
                "quantity": quantity,
                "notes": notes,
            }
        )
    return items


def _sanitize_steps(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    steps: List[Dict[str, Any]] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        order = _to_int(entry.get("order"))
        if order is None:
            continue
        description = _clean_str(entry.get("description"))
        if not description:
            continue
        duration = _to_int(entry.get("durationMinutes"))
        tips = _clean_str(entry.get("tips"))
        steps.append(
            {
                "order": order,
                "description": description,
                "durationMinutes": duration,
                "tips": tips,
            }
        )
    steps.sort(key=lambda item: item["order"])
    return steps


def _sanitize_source(value: Any, content: RawContent) -> Dict[str, Optional[str]]:
    link = content.url
    imported_from = content.platform
    imported_at = None

    if isinstance(value, dict):
        link_candidate = _clean_str(value.get("link"))
        if link_candidate:
            link = link_candidate
        imported_candidate = _clean_str(value.get("importedFrom"))
        if imported_candidate:
            imported_from = imported_candidate
        imported_at = _clean_str(value.get("importedAt"))

    if imported_from not in _ALLOWED_SOURCE_PLATFORMS:
        imported_from = content.platform if content.platform in _ALLOWED_SOURCE_PLATFORMS else None

    return {
        "link": link,
        "importedFrom": imported_from,
        "importedAt": imported_at,
    }



def _recipe_from_record(record: Dict[str, Any]) -> RecipeResponse:
    metadata = record.get("metadata") if isinstance(record.get("metadata"), dict) else {}
    ai_data = metadata.get("ai_recipe") if isinstance(metadata.get("ai_recipe"), dict) else {}
    media_meta = metadata.get("media") if isinstance(metadata.get("media"), dict) else {}
    provenance = metadata.get("provenance") if isinstance(metadata.get("provenance"), dict) else {}

    title = _clean_str(ai_data.get("title")) or _clean_str(record.get("title")) or "Receita sem titulo"
    description = _clean_str(ai_data.get("description"))
    tags = _sanitize_tags(ai_data.get("tags"))
    ingredients = _sanitize_ingredients(ai_data.get("ingredients"))
    steps = _sanitize_steps(ai_data.get("steps"))

    duration = _to_int(ai_data.get("durationMinutes"))
    servings = _to_int(ai_data.get("servings"))

    is_favorite = bool(record.get("is_favorite"))

    difficulty_candidate = _clean_str(ai_data.get("difficulty"))
    difficulty = (
        difficulty_candidate.lower()
        if difficulty_candidate and difficulty_candidate.lower() in _ALLOWED_DIFFICULTIES
        else None
    )

    notes = _clean_str(ai_data.get("notes"))
    cover_image = _clean_str(ai_data.get("coverImage")) or _clean_str(media_meta.get("thumbnail_url"))

    source_data = ai_data.get("source") if isinstance(ai_data.get("source"), dict) else {}
    source_link = _clean_str(source_data.get("link")) or _clean_str(media_meta.get("url"))
    imported_from = _clean_str(source_data.get("importedFrom"))
    if imported_from and imported_from not in _ALLOWED_SOURCE_PLATFORMS:
        imported_from = None
    imported_at = _clean_str(source_data.get("importedAt")) or _clean_str(provenance.get("collected_at"))
    source = None
    if source_link or imported_from or imported_at:
        source = RecipeSource(link=source_link, importedFrom=imported_from, importedAt=imported_at)

    media_payload = ai_data.get("media") if isinstance(ai_data.get("media"), list) else []
    media_items: List[RecipeMedia] = []
    for entry in media_payload:
        if not isinstance(entry, dict):
            continue
        media_type = entry.get("type")
        if media_type not in _ALLOWED_MEDIA_TYPES:
            continue
        url = _clean_str(entry.get("url"))
        if not url:
            continue
        provider = _clean_str(entry.get("provider"))
        if provider and provider not in _ALLOWED_MEDIA_PROVIDERS:
            provider = None
        media_items.append(
            RecipeMedia(
                type=media_type,  # type: ignore[arg-type]
                url=url,
                thumbnailUrl=_clean_str(entry.get("thumbnailUrl")),
                provider=provider,  # type: ignore[arg-type]
            )
        )

    if not media_items:
        fallback_url = _clean_str(media_meta.get("url"))
        if fallback_url:
            fallback_provider = _clean_str(media_meta.get("platform"))
            if fallback_provider not in _ALLOWED_MEDIA_PROVIDERS:
                fallback_provider = "generic"
            media_items.append(
                RecipeMedia(
                    type="video",
                    url=fallback_url,
                    thumbnailUrl=_clean_str(media_meta.get("thumbnail_url")),
                    provider=fallback_provider,  # type: ignore[arg-type]
                )
            )

    return RecipeResponse(
        id=str(record.get("recipe_id")),
        title=title,
        description=description,
        isFavorite=is_favorite,
        durationMinutes=duration,
        servings=servings,
        difficulty=difficulty,  # type: ignore[arg-type]
        tags=tags,
        coverImage=cover_image,
        ingredients=ingredients,
        steps=steps,
        notes=notes,
        source=source,
        media=media_items,
        createdAt=_clean_str(record.get("created_at")),
        updatedAt=_clean_str(record.get("updated_at")),
    )


def _sanitize_media(value: Any, content: RawContent) -> List[Dict[str, Optional[str]]]:
    media_items: List[Dict[str, Optional[str]]] = []
    if isinstance(value, list):
        for entry in value:
            if not isinstance(entry, dict):
                continue
            media_type = entry.get("type")
            if media_type not in _ALLOWED_MEDIA_TYPES:
                continue
            url = _clean_str(entry.get("url"))
            if not url:
                continue
            provider = _clean_str(entry.get("provider"))
            if provider not in _ALLOWED_MEDIA_PROVIDERS:
                provider = None
            thumbnail = _clean_str(entry.get("thumbnailUrl"))
            media_items.append(
                {
                    "type": media_type,
                    "url": url,
                    "thumbnailUrl": thumbnail,
                    "provider": provider,
                }
            )
    if not media_items and content.url:
        provider_default = content.platform if content.platform in _ALLOWED_MEDIA_PROVIDERS else "generic"
        media_items.append(
            {
                "type": "video",
                "url": content.url,
                "thumbnailUrl": content.thumbnail_url,
                "provider": provider_default,
            }
        )
    return media_items


def _build_recipe_response(
    recipe_id: str,
    content: RawContent,
    recipe_data: Any,
) -> Tuple[RecipeResponse, List[str]]:
    warnings: List[str] = []
    data = recipe_data if isinstance(recipe_data, dict) else {}
    if not isinstance(recipe_data, dict):
        warnings.append("Formato inesperado retornado pela IA. Usando valores padrao.")
        data = {}

    title = _clean_str(data.get("title")) if isinstance(data, dict) else None
    if not title:
        title = content.title or "Receita sem titulo"
        warnings.append("IA nao forneceu titulo. Usando titulo coletado do video.")

    description = _clean_str(data.get("description")) if isinstance(data, dict) else None
    tags = _sanitize_tags(data.get("tags")) if isinstance(data, dict) else []

    ingredients = _sanitize_ingredients(data.get("ingredients")) if isinstance(data, dict) else []
    if not ingredients:
        warnings.append("IA nao identificou ingredientes.")

    steps = _sanitize_steps(data.get("steps")) if isinstance(data, dict) else []
    if not steps:
        warnings.append("IA nao identificou passos de preparo.")

    duration = _to_int(data.get("durationMinutes")) if isinstance(data, dict) else None
    servings = _to_int(data.get("servings")) if isinstance(data, dict) else None

    difficulty = None
    if isinstance(data, dict):
        difficulty_candidate = _clean_str(data.get("difficulty"))
        if difficulty_candidate and difficulty_candidate.lower() in _ALLOWED_DIFFICULTIES:
            difficulty = difficulty_candidate.lower()

    notes = _clean_str(data.get("notes")) if isinstance(data, dict) else None
    cover_image = _clean_str(data.get("coverImage")) if isinstance(data, dict) else None
    if not cover_image and content.thumbnail_url:
        cover_image = content.thumbnail_url

    source = _sanitize_source(data.get("source") if isinstance(data, dict) else None, content)
    media = _sanitize_media(data.get("media") if isinstance(data, dict) else None, content)

    recipe_payload = {
        "id": recipe_id,
        "title": title,
        "description": description,
        "isFavorite": False,
        "durationMinutes": duration,
        "servings": servings,
        "difficulty": difficulty,
        "tags": tags,
        "coverImage": cover_image,
        "ingredients": ingredients,
        "steps": steps,
        "notes": notes,
        "source": source,
        "media": media,
        "createdAt": None,
        "updatedAt": None,
    }

    recipe_response = RecipeResponse(**recipe_payload)
    return recipe_response, warnings

@router.get("/", response_model=RecipeListResponse)
async def list_recipes(
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
    search: str | None = Query(
        default=None,
        min_length=2,
        max_length=120,
        alias="q",
        description="Filtro textual aplicado sobre titulo, descricao, notas e tags.",
    ),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> RecipeListResponse:
    query = (
        supa.table("recipes")
        .select("recipe_id,title,metadata,created_at,updated_at,is_favorite", count="exact")
        .eq("owner_id", str(user.id))
        .order("created_at", desc=True)
    )

    if search:
        term = search.strip()
        if term:
            safe_term = (
                term.replace("%", "")
                .replace(",", " ")
                .replace(";", " ")
                .replace("'", " ")
            ).strip()
            if not safe_term:
                safe_term = term
            pattern = f"%{safe_term}%"
            or_filters = [
                f"title.ilike.{pattern}",
                f"metadata->ai_recipe->>title.ilike.{pattern}",
                f"metadata->ai_recipe->>description.ilike.{pattern}",
                f"metadata->ai_recipe->>notes.ilike.{pattern}",
                f"metadata->ai_recipe->>tags.ilike.{pattern}",
            ]
            query = query.or_(",".join(or_filters))

    end = offset + limit - 1
    response = query.range(offset, end).execute()
    records = response.data or []
    items = [_recipe_from_record(row) for row in records]

    total = getattr(response, "count", None)
    if total is None:
        total = len(items)

    return RecipeListResponse(items=items, total=total, limit=limit, offset=offset)

@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: str,
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> RecipeResponse:
    response = (
        supa.table("recipes")
        .select("recipe_id,title,metadata,created_at,updated_at,is_favorite")
        .eq("owner_id", str(user.id))
        .eq("recipe_id", recipe_id)
        .limit(1)
        .execute()
    )
    records = response.data or []
    if not records:
        raise HTTPException(status_code=404, detail="Receita nao encontrada")
    return _recipe_from_record(records[0])


@router.post("/import", response_model=IngestResponse)
async def import_recipe(
    body: IngestRequest,
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> IngestResponse:
    t0 = time.time()
    log.info("ingest.start url=%s owner=%s", body.url, user.id)
    try:
        ingest_result = await run_in_threadpool(run_ingest, str(body.url))
        raw_content = ingest_result.get('raw_content')
        if not isinstance(raw_content, RawContent):
            raise RuntimeError('Ingest pipeline did not return valid raw_content')
        
        metadata = ingest_result.get('metadata') if isinstance(ingest_result.get('metadata'), dict) else {}
        recipe_data = metadata.get('ai_recipe') if isinstance(metadata.get('ai_recipe'), dict) else {}
        
        recipe_id = await run_in_threadpool(
            upsert_recipe_minimal,
            supa,
            str(user.id),
            ingest_result,
        )
        
        try:
            await run_in_threadpool(
                save_chunks,
                supa,
                str(recipe_id),
                ingest_result,
            )
        
        except Exception as exc:
            log.error("ingest.chunk_fail recipe=%s error=%s", recipe_id, str(exc))
            try:
                await run_in_threadpool(
                    delete_recipe_by_id,
                    supa,
                    str(recipe_id),
                )
                log.info("ingest.recipe_deleted recipe=%s", recipe_id)
            except Exception as del_exc:
                log.error("ingest.recipe_delete_fail recipe=%s error=%s", recipe_id, str(del_exc))
            raise RuntimeError(f"Falha ao salvar chunk da receita: {exc}") from exc
        
        recipe_response, warnings = _build_recipe_response(recipe_id, raw_content, recipe_data)
        dt = time.time() - t0
        log.info("ingest.ok url=%s recipe=%s dt=%.2fs", body.url, recipe_id, dt)
        
        return IngestResponse(
            recipe=recipe_response,
            warnings=warnings or None,
        )
        
    except RateLimitedError as exc:
        dt = time.time() - t0
        log.warning("ingest.rate_limited url=%s dt=%.2fs", body.url, dt)
        raise HTTPException(status_code=429, detail="Limite da IA atingido. Tente novamente em alguns instantes.") from exc
    except Exception:
        dt = time.time() - t0
        log.exception("ingest.fail url=%s dt=%.2fs", body.url, dt)
        raise HTTPException(status_code=500, detail="Falha na ingestao")

async def _update_favorite_status(
    supa: Client,
    user: CurrentUser,
    recipe_id: str,
    is_favorite: bool,
) -> RecipeResponse:
    try:
        record = await run_in_threadpool(
            mark_recipe_as_favorite,
            supa,
            str(user.id),
            recipe_id,
            is_favorite,
        )
        return _recipe_from_record(record)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Receita nao encontrada") from exc
    except Exception as exc:
        log.exception(
            "favorite.update_fail recipe=%s user=%s error=%s",
            recipe_id,
            user.id,
            str(exc),
        )
        raise HTTPException(status_code=500, detail="Falha ao atualizar favorito") from exc


@router.post("/{recipe_id}/favorite", response_model=RecipeResponse)
async def favorite_recipe(
    recipe_id: str,
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> RecipeResponse:
    return await _update_favorite_status(supa, user, recipe_id, True)


@router.delete("/{recipe_id}/favorite", response_model=RecipeResponse)
async def unfavorite_recipe(
    recipe_id: str,
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> RecipeResponse:
    return await _update_favorite_status(supa, user, recipe_id, False)
    
    
