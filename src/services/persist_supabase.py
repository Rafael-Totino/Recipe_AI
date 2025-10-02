from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence
from uuid import uuid4

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


def find_similar_chunks(
    supa: Client,
    user_id: str,
    query_embedding: list[float],
    match_threshold: float = 0.75,
    match_count: int = 3,
) -> list[dict]:
    """
    Encontra chunks de receita similares usando busca por similaridade de vetores,
    filtrando apenas os chunks que pertencem ao usuário especificado.
    """
    payload = {
        "owner_id_filter": user_id,
        "query_embedding": query_embedding,
        "match_threshold": match_threshold,
        "match_count": match_count,
    }

    try:
        result = supa.rpc("match_recipe_chunks", payload).execute()
        data = result.data or []
        if data:
            return data
    except Exception as err:
        error_message = str(err)
        if "PGRST202" not in error_message:
            print(f"Erro ao buscar chunks similares: {err}")  # Idealmente, use um logger
            return []

    # Fallback para implementações antigas da função SQL que não aceitam owner_id_filter.
    try:
        legacy_payload = {
            "query_embedding": query_embedding,
            "match_threshold": match_threshold,
            "match_count": match_count,
        }
        result = supa.rpc("match_recipe_chunks", legacy_payload).execute()
        data = result.data or []
        if not data:
            return []

        # Caso a função antiga retorne chunks de múltiplos usuários, filtramos manualmente.
        filtered: list[dict] = []
        for item in data:
            owner_id = str(
                item.get("owner_id")
                or item.get("user_id")
                or item.get("recipe_owner_id")
                or item.get("owner")
                or ""
            )
            if owner_id and owner_id != user_id:
                continue
            filtered.append(item)
        return filtered or data
    except Exception as err:
        print(f"Erro ao buscar chunks similares (fallback): {err}")
        return []


def get_chat_history(
    user_id: str,
    supa: Client,
    limit: int = 50,
    *,
    chat_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Busca o histórico de mensagens de um usuário no banco de dados."""
    try:
        query = supa.table("chat_messages").select("*").eq("user_id", user_id)

        if chat_id:
            query = query.eq("chat_id", chat_id)

        response = query.order("created_at", desc=True).limit(limit).execute()

        records: List[Dict[str, Any]] = response.data or []
        records.reverse()
        return records
    except Exception as e:
        print(f"Erro ao buscar histórico do chat: {e}")
        return []


def list_chat_sessions(
    user_id: str,
    supa: Client,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Retorna metadados resumidos das conversas de um usuário."""
    try:
        response = (
            supa.table("chat_messages")
            .select("chat_id, role, content, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit * 50)
            .execute()
        )

        messages: List[Dict[str, Any]] = response.data or []
        sessions: Dict[str, Dict[str, Any]] = {}

        for record in messages:
            chat_id_value = record.get("chat_id")
            if not chat_id_value:
                # Ignora mensagens antigas sem chat_id definido
                continue

            chat_id = str(chat_id_value)
            created_at_value = record.get("created_at")
            created_at_dt = _coerce_datetime(created_at_value)

            session_info = sessions.get(chat_id)
            if not session_info:
                session_info = {
                    "chat_id": chat_id,
                    "created_at": created_at_dt,
                    "updated_at": created_at_dt,
                    "message_count": 0,
                    "title": None,
                }
                sessions[chat_id] = session_info

            session_info["message_count"] = session_info.get("message_count", 0) + 1

            if created_at_dt < session_info["created_at"]:
                session_info["created_at"] = created_at_dt
            if created_at_dt > session_info["updated_at"]:
                session_info["updated_at"] = created_at_dt

            if not session_info.get("title"):
                role = str(record.get("role") or "").lower()
                if role == "user":
                    content = str(record.get("content") or "").strip()
                    if content:
                        max_length = 60
                        snippet = content[:max_length]
                        if len(content) > max_length:
                            snippet += "…"
                        session_info["title"] = snippet

        return list(sessions.values())
    except Exception as e:
        print(f"Erro ao listar sessões de chat: {e}")
        return []


def save_chat_message(
    user_id: str,
    role: str,
    content: str,
    supa: Client,
    *,
    recipe_id: Optional[str] = None,
    client_message_id: Optional[str] = None,
    chat_id: Optional[str] = None,
    related_recipe_ids: Optional[Sequence[str]] = None,
) -> Dict[str, Any]:
    """Salva uma única mensagem de chat no banco de dados e retorna o registro salvo."""
    try:
        message_data: Dict[str, Any] = {
            "user_id": user_id,
            "role": role,
            "content": content,
        }

        normalized_chat_id = str(chat_id or uuid4())
        message_data["chat_id"] = normalized_chat_id

        normalized_related: List[str] = []
        if recipe_id:
            message_data["recipe_id"] = recipe_id
            normalized_related.append(str(recipe_id))

        if client_message_id:
            message_data["client_message_id"] = client_message_id

        if related_recipe_ids:
            for value in related_recipe_ids:
                if not value:
                    continue
                value_str = str(value)
                if value_str not in normalized_related:
                    normalized_related.append(value_str)

        if normalized_related:
            message_data["related_recipe_ids"] = normalized_related

        insert_builder = supa.table("chat_messages").insert(message_data)
        try:
            result = insert_builder.execute()
        except AttributeError:
            # Algumas versões do cliente não suportam encadeamento de execute, repetimos a chamada.
            result = supa.table("chat_messages").insert(message_data).execute()

        data = result.data
        def _ensure_chat_id(payload: Dict[str, Any]) -> Dict[str, Any]:
            if "chat_id" not in payload:
                payload["chat_id"] = normalized_chat_id
            return payload

        if isinstance(data, list) and data:
            return _ensure_chat_id(data[0])
        if isinstance(data, dict) and data:
            return _ensure_chat_id(data)

        # Se o Supabase não retornou a linha criada, buscamos a mensagem mais recente do usuário.
        history = (
            supa.table("chat_messages")
            .select("*")
            .eq("user_id", user_id)
            .eq("chat_id", normalized_chat_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if history.data:
            record = history.data[0]
            if isinstance(record, dict) and "chat_id" not in record:
                record["chat_id"] = normalized_chat_id
            return record

        return {}
    except Exception as e:
        print(f"Erro ao salvar mensagem do chat: {e}")
        return {}


def get_recipe_chunks(
    supa: Client,
    recipe_id: str,
    *,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Retorna os chunks de uma receita específica ordenados pelo índice."""
    try:
        response = (
            supa.table("recipe_chunks")
            .select("recipe_id, chunk_index, chunk_text")
            .eq("recipe_id", recipe_id)
            .order("chunk_index", desc=False)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as e:
        print(f"Erro ao buscar chunks da receita {recipe_id}: {e}")
        return []


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


def _coerce_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(
                timezone.utc
            )
        except ValueError:
            pass
    return datetime.now(timezone.utc)


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
