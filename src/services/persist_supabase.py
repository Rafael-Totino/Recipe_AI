from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from supabase import Client

from src.services.ids import detect_platform_and_id
from src.services.persist_models import *
from src.services.slugify import slugify, unique_slug
from src.services.types import RawContent
from src.services.embedding import *


def _build_raw_text(
    caption: str | None,
    transcript: str | None,
    subtitles: str | None,
) -> str:
    parts: list[str] = []
    if caption:
        caption_text = caption.strip()
        if caption_text:
            parts.append(f"## CAPTION\n{caption_text}")
    if transcript:
        transcript_text = transcript.strip()
        if transcript_text:
            parts.append(f"## TRANSCRIPT\n{transcript_text}")
    if subtitles:
        subtitles_text = subtitles.strip()
        if subtitles_text:
            if not transcript or subtitles_text != transcript.strip():
                parts.append(f"## SUBTITLES\n{subtitles_text}")
    return "\n\n".join(parts)


def upsert_recipe_minimal(
    supa: Client,
    owner_id: str,
    payload: Dict[str, Any],
) -> str:
    raw_content = payload.get("raw_content")
    if not isinstance(raw_content, RawContent):
        raise ValueError("Missing raw_content in payload")

    metadata_input = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    metadata: Dict[str, Any] = metadata_input.copy()

    platform, platform_item_id = detect_platform_and_id(raw_content.url)

    media = dict(metadata.get("media") or {})
    media.setdefault("thumbnail_url", raw_content.thumbnail_url)
    media.setdefault("author", raw_content.author)
    media.setdefault("platform", platform)
    media.setdefault("url", raw_content.url)
    metadata["media"] = media

    transcript_source = raw_content.transcript_source
    if transcript_source == "audio":
        transcript_source_value = "whisper"
    elif transcript_source == "subtitles":
        transcript_source_value = "captions"
    else:
        transcript_source_value = transcript_source

    provenance = dict(metadata.get("provenance") or {})
    provenance.update(
        {
            "audio_path_local": raw_content.audio_path,
            "transcript_source": transcript_source_value,
        }
    )
    metadata["provenance"] = provenance

    if "raw_text" not in metadata:
        metadata["raw_text"] = _build_raw_text(
            raw_content.caption,
            raw_content.transcript,
            raw_content.subtitles,
        )

    raw_sections = metadata.get("raw_text_sections")
    if not isinstance(raw_sections, dict):
        metadata["raw_text_sections"] = {
            "caption": raw_content.caption,
            "transcript": raw_content.transcript,
            "subtitles": raw_content.subtitles,
        }

    recipe_data = metadata.get("ai_recipe") if isinstance(metadata.get("ai_recipe"), dict) else {}
    metadata["ai_recipe"] = recipe_data

    title_from_ai = recipe_data.get("title") if isinstance(recipe_data, dict) else None
    title = title_from_ai or raw_content.title or "Sem titulo"
    slug = unique_slug(slugify(title))
    collected_at = datetime.now(timezone.utc).isoformat()
    metadata["provenance"]["collected_at"] = collected_at

    recipe = RecipeRecord(
        owner_id=owner_id,
        slug=slug,
        title=title,
        metadata=metadata,
    )
    result = supa.table("recipes").insert(recipe.model_dump()).execute()
    recipe_id = result.data[0]["recipe_id"]

    source = RecipeSourceRecord(
        recipe_id=recipe_id,
        platform=platform,
        platform_item_id=platform_item_id,
        url=raw_content.url,
        author_name=raw_content.author,
        collected_at=collected_at,
        provenance={"thumbnail_url": raw_content.thumbnail_url},
    )
    supa.table("recipe_sources").insert(source.model_dump()).execute()
    return recipe_id


def save_chunks(supa: Client, recipe_id: str, payload: Dict[str, Any]):
    
    chunk_text = stringify_payload(payload)
    chunk = ChunkRecord(
        recipe_id=recipe_id,  
        chunk_index=0,  
        chunk_text=chunk_text,
        embedding=embedding_document(chunk_text),  
    )
    supa.table("recipe_chunks").insert(chunk.model_dump()).execute()