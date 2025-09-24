# src/app/deps.py
from __future__ import annotations
from supabase import create_client, Client
from src.app.config import settings

_supabase: Client | None = None

def get_supabase() -> Client:
    """
    Retorna um cliente Supabase (service_role) singleton.
    Use SOMENTE no backend. No frontend, use anon key.
    """
    global _supabase
    if _supabase is None:
        _supabase = create_client(str(settings.SUPABASE_URL), settings.SUPABASE_SERVICE_ROLE_KEY)
    return _supabase
