from __future__ import annotations
from typing import Any, Dict, List, Optional, Sequence
from datetime import datetime, timezone
from uuid import uuid4

from src.services.chat_agent import run_chat_agent
from supabase import Client
from src.app.deps import CurrentUser
from src.services.embedding import embedding_query
from src.services import persist_supabase


MAX_CONTEXT_CHARS = 4000
MAX_HISTORY_MESSAGES = 50


def send_message(
    user: CurrentUser,
    supa: Client,
    message: str,
    recipe_id: Optional[str] = None,
    client_message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Orquestra o processo de resposta do chat:
    1. Salva a mensagem do usuário.
    2. Busca contexto relevante (RAG).
    3. Busca o histórico completo da conversa.
    4. Chama a IA com o histórico e o contexto.
    5. Salva a resposta da IA.
    """
    user_id = str(user.id)

    # 1. Salva a mensagem do usuário no banco de dados
    persist_supabase.save_chat_message(
        user_id,
        "user",
        message,
        supa,
        recipe_id=recipe_id,
        client_message_id=client_message_id,
    )

    # 2. Busca o contexto relevante (da receita específica ou por similaridade)
    context_text, context_recipe_ids = get_context(
        message=message,
        recipe_id=recipe_id,
        user=user,
        supa=supa,
    )

    # 3. Busca o histórico completo do banco de dados para dar memória à IA
    full_history = persist_supabase.get_chat_history(
        user_id,
        supa,
        limit=MAX_HISTORY_MESSAGES,
    )
    history_payload = _build_history_payload(full_history)

    if history_payload:
        last_entry = history_payload[-1]
        if last_entry.get("role") == "user" and last_entry.get("content") == message:
            history_payload = history_payload[:-1]

    # 4. Chama o agente com o histórico correto e o contexto
    assistant_text = run_chat_agent(history_payload, message, context_text)

    # 5. Salva a resposta do assistente no banco de dados
    assistant_record = persist_supabase.save_chat_message(
        user_id,
        "assistant",
        assistant_text,
        supa,
        related_recipe_ids=context_recipe_ids or None,
    )

    return _format_chat_message(assistant_record)


def list_messages(user_id: str, supa: Client, limit: int = 50) -> List[Dict[str, Any]]:
    """Retorna o histórico do chat no formato esperado pela API."""
    records = persist_supabase.get_chat_history(user_id, supa, limit=limit)
    return [_format_chat_message(record) for record in records]


def get_context(
    message: str,
    recipe_id: Optional[str],
    user: CurrentUser,
    supa: Client,
) -> tuple[Optional[str], List[str]]:
    """Busca o contexto relevante para uma pergunta, seja de uma receita específica ou por similaridade."""
    user_id = str(user.id)

    # Cenário 1: O usuário está vendo uma receita específica
    if recipe_id:
        chunks = persist_supabase.get_recipe_chunks(supa, recipe_id)
        if not chunks:
            return None, [str(recipe_id)]

        context_parts: List[str] = []
        for chunk in chunks:
            compressed = compress_chunk_text(chunk.get("chunk_text", ""))
            if compressed:
                context_parts.append(compressed)

        context_text = _truncate_context("\n\n".join(context_parts).strip())
        return (context_text or None, [str(recipe_id)])

    # Cenário 2: O usuário faz uma pergunta genérica
    try:
        message_embeded = embedding_query(message)
    except Exception as exc:
        print(f"Erro ao gerar embedding da mensagem: {exc}")
        return None, []
    similar_chunks = persist_supabase.find_similar_chunks(
        supa,
        user_id,
        message_embeded,
    )

    if not similar_chunks:
        return None, []

    context_parts = [
        "Com base nas suas receitas, aqui estão algumas informações que podem ser úteis:",
    ]
    related_recipe_ids: List[str] = []

    for chunk in similar_chunks:
        recipe_id_value = chunk.get("recipe_id")
        if recipe_id_value:
            recipe_id_str = str(recipe_id_value)
            if recipe_id_str not in related_recipe_ids:
                related_recipe_ids.append(recipe_id_str)

        full_chunk_text = chunk.get("chunk_text", "")
        compressed_text = compress_chunk_text(full_chunk_text)
        if compressed_text:
            context_parts.append(f"\n--- Trecho de Receita ---\n{compressed_text}")

    if len(context_parts) > 1:
        return _truncate_context("\n".join(context_parts)), related_recipe_ids

    return None, related_recipe_ids


def _truncate_context(context: str) -> str:
    if not context:
        return ""
    if len(context) <= MAX_CONTEXT_CHARS:
        return context
    return context[:MAX_CONTEXT_CHARS].rstrip() + "..."
        
        
def compress_chunk_text(full_text: str) -> str:
    """
    Extrai apenas as seções da receita relevantes para o chat,
    removendo metadados como IDs, status e timestamps.
    """
    if not full_text:
        return ""

    # Lista de seções que são úteis para o contexto do chat.
    important_headers = [
        "Título", "Descrição", "Ingredientes", "Passos", "Notas", "Tags",
    ]
    
    compressed_parts = []
    # Divide o texto em seções e ignora qualquer conteúdo antes do primeiro cabeçalho '##'
    sections = full_text.split('## ')[1:]
    
    for section in sections:
        if not section.strip():
            continue
        
        # Pega o título da seção (a primeira linha) para ver se está na lista de permissão
        section_title = section.split('\n', 1)[0].strip()
        
        if section_title in important_headers:
            compressed_parts.append(f"## {section.strip()}")
                
    # Junta as seções importantes com um espaçamento melhor para a IA
    condensed_text = "\n\n".join(compressed_parts).strip()

    if not condensed_text:
        condensed_text = full_text.strip()

    max_length = 1500
    if len(condensed_text) > max_length:
        condensed_text = condensed_text[:max_length].rstrip() + "..."

    return condensed_text


def _build_history_payload(records: Sequence[Dict[str, Any]]) -> List[Dict[str, str]]:
    history: List[Dict[str, str]] = []
    for item in records:
        role = item.get("role")
        content = item.get("content")
        if not role or not content:
            continue
        history.append({"role": role, "content": content})
    return history


def _format_chat_message(record: Dict[str, Any]) -> Dict[str, Any]:
    """Normaliza o formato da mensagem para o contrato da API."""
    if not record:
        return {
            "id": str(uuid4()),
            "role": "assistant",
            "content": "",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }

    message_id = (
        record.get("message_id")
        or record.get("id")
        or record.get("uuid")
        or str(uuid4())
    )

    created_at = record.get("created_at")
    if isinstance(created_at, datetime):
        created_at_iso = created_at.astimezone(timezone.utc).isoformat()
    elif isinstance(created_at, str) and created_at:
        try:
            created_at_iso = datetime.fromisoformat(created_at.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
        except ValueError:
            created_at_iso = created_at
    else:
        created_at_iso = datetime.now(timezone.utc).isoformat()

    related_recipe_ids = record.get("related_recipe_ids")
    if isinstance(related_recipe_ids, str):
        related_recipe_ids = [related_recipe_ids]
    elif isinstance(related_recipe_ids, list):
        related_recipe_ids = [str(value) for value in related_recipe_ids if value]
        if not related_recipe_ids:
            related_recipe_ids = None
    else:
        related_recipe_ids = None

    suggestions = record.get("suggestions")
    if suggestions is not None and not isinstance(suggestions, list):
        suggestions = None

    return {
        "id": str(message_id),
        "role": record.get("role", "assistant"),
        "content": record.get("content", ""),
        "createdAt": created_at_iso,
        "relatedRecipeIds": related_recipe_ids,
        "suggestions": suggestions,
    }

