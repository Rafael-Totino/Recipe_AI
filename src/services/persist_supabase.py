from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from supabase import Client

from src.services.ids import detect_platform_and_id
from src.services.persist_models import RecipeRecord, RecipeSourceRecord
from src.services.slugify import slugify, unique_slug
from src.services.types import RawContent


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
    content: RawContent,
    recipe_data: Dict[str, Any],
) -> str:
    platform, platform_item_id = detect_platform_and_id(content.url)
    title_from_ai = recipe_data.get("title") if isinstance(recipe_data, dict) else None
    title = title_from_ai or content.title or "Sem titulo"
    slug = unique_slug(slugify(title))
    collected_at = datetime.now(timezone.utc).isoformat()

    transcript_source = content.transcript_source
    if transcript_source == "audio":
        transcript_source_value = "whisper"
    elif transcript_source == "subtitles":
        transcript_source_value = "captions"
    else:
        transcript_source_value = transcript_source

    recipe = RecipeRecord(
        owner_id=owner_id,
        slug=slug,
        title=title,
        metadata={
            "media": {
                "thumbnail_url": content.thumbnail_url,
                "author": content.author,
                "platform": platform,
                "url": content.url,
            },
            "provenance": {
                "audio_path_local": content.audio_path,
                "collected_at": collected_at,
                "transcript_source": transcript_source_value,
            },
            "raw_text": _build_raw_text(content.caption, content.transcript, content.subtitles),
            "ai_recipe": recipe_data,
        },
    )
    result = supa.table("recipes").insert(recipe.model_dump()).execute()
    recipe_id = result.data[0]["recipe_id"]

    source = RecipeSourceRecord(
        recipe_id=recipe_id,
        platform=platform,
        platform_item_id=platform_item_id,
        url=content.url,
        author_name=content.author,
        collected_at=collected_at,
        provenance={"thumbnail_url": content.thumbnail_url},
    )
    supa.table("recipe_sources").insert(source.model_dump()).execute()
    return recipe_id
