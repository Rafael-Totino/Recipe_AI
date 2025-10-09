from __future__ import annotations

import re
from pathlib import Path
from typing import Optional, Tuple

import yt_dlp
from youtube_transcript_api import (
    NoTranscriptFound,
    TranscriptsDisabled,
    YouTubeTranscriptApi,
)

from .errors import (
    AudioUnavailableError,
    FetchFailedError,
    InvalidURLError,
    PrivateOrUnavailableError,
)
from .types import RawContent


def _extract_thumbnail(info: dict | None) -> Optional[str]:
    """Retorna a melhor URL de thumbnail disponivel no metadata."""

    def _clean(value: object) -> Optional[str]:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return None

    if not isinstance(info, dict):
        return None

    direct = _clean(info.get("thumbnail")) or _clean(info.get("thumbnail_url"))
    if direct:
        return direct

    thumbnails = info.get("thumbnails")
    if isinstance(thumbnails, list):
        sortable_entries = []
        for entry in thumbnails:
            if not isinstance(entry, dict):
                continue
            url = _clean(entry.get("url"))
            if not url:
                continue
            preference = entry.get("preference")
            width = entry.get("width")
            height = entry.get("height")
            sortable_entries.append(
                (
                    (preference if isinstance(preference, (int, float)) else 0),
                    (width if isinstance(width, (int, float)) else 0),
                    (height if isinstance(height, (int, float)) else 0),
                    url,
                )
            )

        if sortable_entries:
            sortable_entries.sort(reverse=True)
            return sortable_entries[0][3]

    return None


def fetch_youtube(url: str) -> RawContent:
    if "youtube.com" not in url and "youtu.be" not in url:
        raise InvalidURLError(f"URL nao e do YouTube: {url}")

    try:
        ydl_opts = {
            "quiet": True,
            "noprogress": True,
            "skip_download": True,
            "check_formats": False,
            "extractor_args": {
                "youtube": {
                    "player_client": ["android"],
                }
            },
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        if info.get("is_private") or info.get("availability") in {"private", "needs_auth"}:
            raise PrivateOrUnavailableError("Video privado ou requer login.")

        subtitles_text = _get_yt_transcript(url)
        if not subtitles_text:
            subtitles_text = _extract_caption_text(info)

        audio_path: Optional[str] = None
        try:
            audio_path = download_audio(url)
        except AudioUnavailableError:
            audio_path = None

        return RawContent(
            platform="youtube",
            url=url,
            title=info.get("title") or "Sem titulo",
            caption=info.get("description"),
            transcript=None,
            subtitles=subtitles_text,
            transcript_source=None,
            audio_path=audio_path,
            thumbnail_url=_extract_thumbnail(info),
            author=info.get("uploader"),
        )

    except (PrivateOrUnavailableError, InvalidURLError):
        raise
    except Exception as exc:
        raise FetchFailedError(f"Erro inesperado ao coletar video: {exc}") from exc


def fetch_instagram(url: str) -> RawContent:
    if "instagram.com" not in url:
        raise InvalidURLError(f"URL nao e do Instagram: {url}")

    try:
        ydl_opts = {
            "quiet": True,
            'writethumbnail': True,
            "noprogress": True,
            "skip_download": True,
            "check_formats": False,
            "extractor_args": {
                "youtube": {
                    "player_client": ["android"],
                }
            },
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        if not info:
            raise PrivateOrUnavailableError("Post privado ou nao disponivel")

        audio_path: Optional[str] = None
        try:
            audio_path = download_audio(url)
        except AudioUnavailableError:
            audio_path = None

        return RawContent(
            platform="instagram",
            url=url,
            title=info.get("title") or "Sem titulo",
            caption=info.get("description"),
            transcript=None,
            subtitles=None,
            transcript_source=None,
            audio_path=audio_path,
            thumbnail_url=_extract_thumbnail(info),
            author=info.get("uploader") or info.get("channel") or "Desconhecido",
        )

    except (PrivateOrUnavailableError, InvalidURLError):
        raise
    except Exception as exc:
        raise FetchFailedError(f"Erro inesperado ao coletar video: {exc}") from exc


def _pick_caption_text(submap: Optional[dict]) -> Optional[Tuple[str, str, str]]:
    if not submap:
        return None
    langs_priority = ["pt-BR", "pt", "en"]
    ext_priority = ["vtt"]
    for lang in langs_priority:
        entries = submap.get(lang)
        if not entries:
            continue
        for ext in ext_priority:
            for item in entries:
                if item.get("ext") == ext and item.get("url"):
                    return item.get("url"), lang, ext
    return None


def _vtt_to_plain_text_str(content: str) -> str:
    tag_re = re.compile(r"<[^>]+>")

    lines_out = []
    in_note = False

    for raw in content.splitlines():
        if in_note:
            if raw.strip() == "":
                in_note = False
            continue

        line = raw.strip()
        if line == "":
            continue
        if line == "WEBVTT":
            continue
        if line.startswith("NOTE"):
            in_note = True
            continue
        if line.startswith("STYLE") or line.startswith("REGION"):
            continue
        if "-->" in line:
            continue
        if line.isdigit():
            continue

        line = tag_re.sub("", line).strip()
        if line:
            lines_out.append(line)

    text = " ".join(lines_out)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _download_vtt_as_text(url: str, timeout: float = 15.0) -> str:
    import httpx

    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        vtt_content = response.text
    return _vtt_to_plain_text_str(vtt_content)


def _extract_caption_text(info: dict) -> Optional[str]:
    for key in ("subtitles", "automatic_captions"):
        picked = _pick_caption_text(info.get(key))
        if picked:
            url, _, _ = picked
            return _download_vtt_as_text(url)
    return None


def _get_yt_transcript(url: str) -> Optional[str]:
    match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
    if not match:
        return None
    video_id = match.group(1)
    languages = ["pt-BR", "pt", "en"]

    try:
        data = YouTubeTranscriptApi.get_transcript(video_id, languages=languages)
    except AttributeError:
        try:
            transcript_list = YouTubeTranscriptApi().fetch(video_id, languages=languages)
        except (TranscriptsDisabled, NoTranscriptFound):
            return None
        except Exception as exc:
            print(f"Erro inesperado ao buscar transcript: {exc}")
            return None
        else:
            data = transcript_list.to_raw_data()
    except (TranscriptsDisabled, NoTranscriptFound):
        return None
    except Exception as exc:
        print(f"Erro inesperado ao buscar transcript: {exc}")
        return None

    if hasattr(data, "to_raw_data"):
        data = data.to_raw_data()

    parts = [item.get("text", "").strip() for item in data if item.get("text")]
    full_text = " ".join(parts)
    return full_text.strip() or None

def download_audio(url: str) -> Optional[str]:
    audio_dir = Path("data/audio")
    audio_dir.mkdir(parents=True, exist_ok=True)
    outtmpl = str(audio_dir / "%(id)s.%(ext)s")

    ydl_opts_audio = {
        "quiet": True,
        "noprogress": True,
        "format": "bestaudio/best",
        "check_formats": False,
        "extractor_args": {
            "youtube": {
                "player_client": ["android"],
            }
        },
        "outtmpl": outtmpl,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "m4a",
                "preferredquality": "192",
            }
        ],
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts_audio) as ydl:
            info_audio = ydl.extract_info(url, download=True)
    except Exception as exc:
        raise AudioUnavailableError(f"Erro ao baixar audio: {exc}") from exc

    requested = info_audio.get("requested_downloads")
    if requested:
        first = requested[0]
        return first.get("filepath") or first.get("filename")

    return info_audio.get("filepath") or info_audio.get("_filename")


