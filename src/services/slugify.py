# src/services/slugify.py
import re
import unicodedata
import secrets

def slugify(text: str) -> str:
    """Transforma texto em slug: minúsculo, sem acentos, com hifens."""
    # remove acentos
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    # troca tudo que não é letra/número por "-"
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return t or "recipe"

def unique_slug(base: str) -> str:
    """Adiciona sufixo aleatório curto para evitar colisões."""
    return f"{base}-{secrets.token_hex(3)}"  # ex.: bolo-de-cenoura-a1b2c3
