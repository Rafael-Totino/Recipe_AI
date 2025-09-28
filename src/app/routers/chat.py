from __future__ import annotations

from fastapi import APIRouter, Depends

from src.app.deps import CurrentUser, get_current_user
from src.app.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from src.services import chat_store
from fastapi import HTTPException

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/history", response_model=list[ChatMessage])
async def get_history(user: CurrentUser = Depends(get_current_user)) -> list[ChatMessage]:
    return [ChatMessage(**msg) for msg in chat_store.list_messages(str(user.id))]



@router.post("/", response_model=ChatResponse)
async def post_message(
    payload: ChatRequest,
    user: CurrentUser = Depends(get_current_user),
) -> ChatResponse:
    try:
        assistant_msg = chat_store.send_message(
            str(user.id),
            payload.message,
            recipe_id=payload.recipeId,
            client_message_id=payload.threadId,
        )
        return ChatResponse(message=ChatMessage(**assistant_msg))
    except Exception as exc:
        # Log do erro pode ser adicionado aqui se necessário
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar mensagem do chat: {str(exc)}"
        )
