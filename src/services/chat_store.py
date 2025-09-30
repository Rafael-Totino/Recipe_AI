from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import uuid

from src.services.chat_agent import run_chat_agent
from supabase import Client
from src.app.deps import CurrentUser
from src.services.embedding import embedding_query
from src.services import persist_supabase


def send_message(
    user: CurrentUser,
    supa: Client,
    message: str,
    recipe_id: Optional[str] = None,
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
    persist_supabase.save_chat_message(user_id, "user", message, recipe_id, supa)

    # 2. Busca o contexto relevante (da receita específica ou por similaridade)
    context_payload = type('obj', (object,), {'recipeId': recipe_id, 'message': message})
    context = get_context(context_payload, user, supa)

    # 3. Busca o histórico completo do banco de dados para dar memória à IA
    full_history = persist_supabase.get_chat_history(user_id, supa)
    history_payload = [{"role": item["role"], "content": item["content"]} for item in full_history]
    
    # 4. Chama o agente com o histórico correto e o contexto
    assistant_text = run_chat_agent(history_payload, message, context)

    # 5. Salva a resposta do assistente no banco de dados
    assistant_entry = persist_supabase.save_chat_message(user_id, "assistant", assistant_text, None, supa)

    return assistant_entry


def get_context(user_payload, user: CurrentUser, supa: Client) -> Optional[str]:
    """Busca o contexto relevante para uma pergunta, seja de uma receita específica ou por similaridade."""
    user_id = str(user.id)

    # Cenário 1: O usuário está vendo uma receita específica
    if user_payload.recipeId:
        try:
            # Busca o chunk da receita, garantindo que pertence ao usuário
            chunk_result = persist_supabase.get_chunk_by_id(user_payload.recipeId, user_id, supa)
            if chunk_result and chunk_result.data:
                full_chunk_text = chunk_result.data[0].get('chunk_text', '')
                return compress_chunk_text(full_chunk_text)
            return None
        except Exception as e:
            print(f"Erro ao buscar chunk pelo ID {user_payload.recipeId}: {e}")
            return None

    # Cenário 2: O usuário faz uma pergunta genérica
    else:
        message_embeded = embedding_query(user_payload.message)
        similar_chunks = persist_supabase.find_similar_chunks(
            supa,
            user_id,
            message_embeded,
        )

        if not similar_chunks:
            return None

        context_parts = ["Com base nas suas receitas, aqui estão algumas informações que podem ser úteis:"]
        for chunk in similar_chunks:
            full_chunk_text = chunk.get('chunk_text', '')
            compressed_text = compress_chunk_text(full_chunk_text)
            if compressed_text:
                context_parts.append(f"\n--- Trecho de Receita ---\n{compressed_text}")

        if len(context_parts) > 1:
            return "\n".join(context_parts)

        return None
        
        
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
    return "\n\n".join(compressed_parts)

