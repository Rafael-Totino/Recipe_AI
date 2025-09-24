# src/app/deps.py (mantém o singleton, mas expõe como dependência)
from supabase import create_client, Client
from src.app.config import settings

_client: Client | None = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(str(settings.SUPABASE_URL),
                                settings.SUPABASE_SERVICE_ROLE_KEY)
    return _client
