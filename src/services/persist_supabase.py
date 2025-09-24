# src/services/persist_supabase.py
from datetime import datetime, timezone

from supabase import Client

from src.services.ids import detect_platform_and_id
from src.services.persist_models import RecipeRecord, RecipeSourceRecord
from src.services.slugify import slugify, unique_slug
from src.services.types import RawContent


def _build_raw_text(caption: str | None, transcript: str | None) -> str:
    parts: list[str] = []
    if caption:
        parts.append(f"## CAPTION\n{caption.strip()}")
    if transcript:
        parts.append(f"## TRANSCRIPT\n{transcript.strip()}")
    return "\n\n".join(parts)


def upsert_recipe_minimal(supa: Client, owner_id: str, content: RawContent) -> str:
    platform, platform_item_id = detect_platform_and_id(content.url)
    slug = unique_slug(slugify(content.title or "receita"))
    collected_at = datetime.now(timezone.utc).isoformat()

    recipe = RecipeRecord(
        owner_id=owner_id,
        slug=slug,
        title=content.title or "Sem titulo",
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
                "transcript_source": "whisper" if content.transcript else None,
            },
            "raw_text": _build_raw_text(content.caption, content.transcript),
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
