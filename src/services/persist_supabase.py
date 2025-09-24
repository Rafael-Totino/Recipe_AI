# src/services/persist_supabase.py
from __future__ import annotations
from datetime import datetime, timezone
from supabase import Client
from src.services.types import RawContent
from src.services.ids import detect_platform_and_id
from src.services.slugify import slugify, unique_slug

def build_raw_text(caption: str | None, transcript: str | None) -> str:
    parts = []
    if caption:
        parts.append("## CAPTION\n" + caption.strip())
    if transcript:
        parts.append("## TRANSCRIPT\n" + transcript.strip())
    return "\n\n".join(parts)

def upsert_recipe_minimal(supa: Client, owner_id: str, content: RawContent) -> str:
    # 1. Descobrir a plataforma e o ID único
    platform, platform_item_id = detect_platform_and_id(content.url)
    
    # 2. Criar slug amigável
    slug = unique_slug(slugify(content.title or "receita"))

    # 3. Montar texto bruto (caption + transcript)
    raw_text = build_raw_text(content.caption, content.transcript)
    collected_at = datetime.now(timezone.utc).isoformat()

    # 4. Inserir na tabela recipes
    recipe_insert = {
        "owner_id": owner_id,
        "slug": slug,
        "title": content.title or "Sem título",
        "status": "published",
        "version": 1,
        "metadata": {
            "media": {
                "thumbnail_url": content.thumbnail_url,
                "author": content.author,
                "platform": platform,
                "url": content.url,
            },
            "provenance": {
                "audio_path_local": content.audio_path,
                "collected_at": collected_at,
            },
            "raw_text": raw_text,
        },
    }

    r = supa.table("recipes").insert(recipe_insert).execute()
    recipe_id = r.data[0]["recipe_id"]

    # 5. Inserir a fonte (recipe_sources)
    src_insert = {
        "recipe_id": recipe_id,
        "platform": platform,
        "platform_item_id": platform_item_id,
        "url": content.url,
        "author_name": content.author,
        "collected_at": collected_at,
    }
    supa.table("recipe_sources").insert(src_insert).execute()

    return recipe_id
