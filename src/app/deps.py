# src/app/deps.py (mantém o singleton, mas expõe como dependência)

from __future__ import annotations
from supabase import create_client, Client
from src.app.config import settings
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

_client: Client | None = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(str(settings.SUPABASE_URL),
                                settings.SUPABASE_SERVICE_ROLE_KEY)
    return _client


auth_scheme = HTTPBearer(auto_error=False)

class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    name: str | None = None

async def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    supa: Client = Depends(get_supabase),
) -> CurrentUser:
    """
    Recebe Authorization: Bearer <access_token> do Supabase,
    valida no GoTrue e retorna dados mínimos do usuário.
    """
    if cred is None or cred.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    token = cred.credentials
    try:
        # valida token e obtém o usuário (Admin API do supabase-py)
        res = supa.auth.get_user(token)
        user = res.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        # metadados podem conter 'name'
        name = None
        meta = getattr(user, "user_metadata", None) or {}
        if isinstance(meta, dict):
            name = meta.get("name")

        return CurrentUser(id=str(user.id), email=user.email, name=name)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid/expired token")
