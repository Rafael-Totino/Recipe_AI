# src/services/ids.py
import re
from typing import Literal, Tuple

Platform = Literal["youtube", "instagram"]

# Regex simplificado para YouTube
_YT_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/|live/))([A-Za-z0-9_-]{6,})"
)

# Regex simplificado para Instagram (post/reel)
_IG_RE = re.compile(
    r"instagram\.com/(?:reel|p)/([A-Za-z0-9_-]{5,})"
)

def detect_platform_and_id(url: str) -> Tuple[Platform, str]:
    """Retorna (plataforma, id_unico) a partir de uma URL."""
    m = _YT_RE.search(url)
    if m:
        return "youtube", m.group(1)
    m = _IG_RE.search(url)
    if m:
        return "instagram", m.group(1)
    raise ValueError(f"URL não reconhecida como YouTube ou Instagram: {url}")
