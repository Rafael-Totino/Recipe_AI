from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client

from src.services.ids import detect_platform_and_id
from src.services.persist_models import *
from src.services.slugify import slugify, unique_slug
from src.services.types import RawContent
from src.services.embedding import *


def get_chunk_by_id(recipe_id: str, user_id: str, supa: Client):
    """
    Busca o chunk de uma receita específica, garantindo que ela pertence ao usuário.
    Chama a função SQL segura 'get_user_chunk_by_id' para evitar vazamento de dados.
    """
    return supa.rpc(
        "get_user_chunk_by_id",
        {"recipe_id_filter": recipe_id, "user_id_filter": user_id},
    ).execute()


def find_similar_chunks(supa: Client, user_id: str, query_embedding: list[float], match_threshold: float = 0.75, match_count: int = 3) -> list[dict]:
    """
    Encontra chunks de receita similares usando busca por similaridade de vetores,
    filtrando apenas os chunks que pertencem ao usuário especificado.
    """
    try:
        result = supa.rpc(
            "match_recipe_chunks",
            {
                "owner_id_filter": user_id,
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count,
            },
        ).execute()

        return result.data if result.data else []
    except Exception as e:
        print(f"Erro ao buscar chunks similares: {e}") # Idealmente, use um logger
        return []


def get_chat_history(user_id: str, supa: Client, limit: int = 50) -> List[Dict[str, Any]]:
    """Busca o histórico de mensagens de um usuário no banco de dados."""
    try:
        result = (
            supa.table("chat_messages")
            .select("role, content")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )
        return result.data if result.data else []
    except Exception as e:
        print(f"Erro ao buscar histórico do chat: {e}")
        return []


def save_chat_message(user_id: str, role: str, content: str, recipe_id: Optional[str], supa: Client) -> Dict[str, Any]:
    """Salva uma única mensagem de chat no banco de dados e retorna o registro salvo."""
    try:
        message_data = {
            "user_id": user_id,
            "role": role,
            "content": content,
            "related_recipe_ids": [recipe_id] if recipe_id else None,
        }
        result = supa.table("chat_messages").insert(message_data).select("*").single().execute()
        return result.data if result.data else {}
    except Exception as e:
        print(f"Erro ao salvar mensagem do chat: {e}")
        return {}


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
    
def delete_recipe_by_id(supa: Client, recipe_id: str):
    """Exclui a receita e seus dados relacionados pelo recipe_id."""
    supa.table("recipes").delete().eq("recipe_id", recipe_id).execute()
    supa.table("recipe_sources").delete().eq("recipe_id", recipe_id).execute()
    supa.table("recipe_chunks").delete().eq("recipe_id", recipe_id).execute()
    
def get_recipe_by_id(recipe_id: str, supa):
    recipe = (
        supa.table("recipes")
        .select("recipe_id,title,metadata,created_at,updated_at")
        .eq("recipe_id", recipe_id)
        .limit(1)
        .execute()
    )
    return "recipe"
