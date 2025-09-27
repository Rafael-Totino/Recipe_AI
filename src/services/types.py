from dataclasses import dataclass
from typing import Literal, Optional


@dataclass
class RawContent:
    platform: Literal["youtube", "instagram"]
    url: str
    title: Optional[str]
    caption: Optional[str]
    transcript: Optional[str]
    subtitles: Optional[str]
    transcript_source: Optional[str]
    audio_path: Optional[str]
    thumbnail_url: Optional[str]
    author: Optional[str]
