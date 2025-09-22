from dataclasses import dataclass
from typing import Optional, Literal

@dataclass
class RawContent:
    platform: Literal["youtube", "instagram"]
    url: str
    title: Optional[str]
    caption: Optional[str]
    transcript: Optional[str]  # legendas extraídas (quando houver)
    audio_path: Optional[str]    # caminho local do áudio (para transcrever)
    thumbnail_url: Optional[str]
    author: Optional[str]
    
