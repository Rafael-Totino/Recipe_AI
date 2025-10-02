from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from src.app.deps import CurrentUser, get_current_user, get_supabase
from src.app.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from src.services import chat_store

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/history", response_model=list[ChatMessage])
async def get_history(
    chat_id: str | None = Query(default=None, alias="chatId"),
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> list[ChatMessage]:
    return [
        ChatMessage(**msg)
        for msg in chat_store.list_messages(str(user.id), supa, chat_id=chat_id)
    ]



@router.post("/", response_model=ChatResponse)
async def post_message(
    payload: ChatRequest,
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> ChatResponse:
    try:
        chat_result = chat_store.send_message(
            user=user,
            supa=supa,
            message=payload.message,
            recipe_id=payload.recipeId,
            client_message_id=payload.threadId,
            chat_id=payload.chatId,
        )
        return ChatResponse(
            message=ChatMessage(**chat_result["assistant"]),
            userMessage=ChatMessage(**chat_result["user"]),
        )
    except Exception as exc:
        # Log do erro pode ser adicionado aqui se necessário
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar mensagem do chat: {str(exc)}"
        )
        
        

