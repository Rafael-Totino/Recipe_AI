from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

import httpx
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
    NetworkTimeoutError,
)
from .types import RawContent

logger = logging.getLogger(__name__)

YOUTUBE_VIDEO_ID_PATTERN = re.compile(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})")
VTT_TAG_PATTERN = re.compile(r"<[^>]+>")
WHITESPACE_PATTERN = re.compile(r"\s+")
PRIORITY_LANGUAGES = ("pt-BR", "pt", "en")
VTT_SKIP_PREFIXES = ("NOTE", "STYLE", "REGION", "WEBVTT")


@dataclass(frozen=True)
class CaptionSource:
    url: str
    language: str
    extension: str


def _clean_string(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _safe_numeric(value: object, default: int | float = 0) -> int | float:
    return value if isinstance(value, (int, float)) else default


def _extract_thumbnail(info: dict | None) -> str | None:
    if not isinstance(info, dict):
        return None

    direct_url = _clean_string(info.get("thumbnail")) or _clean_string(info.get("thumbnail_url"))
    if direct_url:
        return direct_url

    return _find_best_thumbnail_from_list(info.get("thumbnails"))


def _find_best_thumbnail_from_list(thumbnails: list | None) -> str | None:
    if not isinstance(thumbnails, list):
        return None

    scored_thumbnails = [
        (_score_thumbnail(entry), _clean_string(entry.get("url")))
        for entry in thumbnails
        if isinstance(entry, dict) and _clean_string(entry.get("url"))
    ]

    if not scored_thumbnails:
        return None

    scored_thumbnails.sort(reverse=True, key=lambda x: x[0])
    return scored_thumbnails[0][1]


def _score_thumbnail(entry: dict) -> tuple[int | float, int | float, int | float]:
    return (
        _safe_numeric(entry.get("preference")),
        _safe_numeric(entry.get("width")),
        _safe_numeric(entry.get("height")),
    )


def _create_ydl_options(download: bool = False, audio_only: bool = False) -> dict:
    base_opts = {
        "quiet": True,
        "noprogress": True,
        "check_formats": False,
        "extractor_args": {"youtube": {"player_client": ["android"]}},
    }

    if not download:
        base_opts["skip_download"] = True
        return base_opts

    if audio_only:
        base_opts["format"] = "bestaudio/best"
        base_opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "m4a",
            "preferredquality": "192",
        }]

    return base_opts


def _validate_youtube_url(url: str) -> None:
    if "youtube.com" not in url and "youtu.be" not in url:
        raise InvalidURLError(f"URL nao e do YouTube: {url}")


def _validate_instagram_url(url: str) -> None:
    if "instagram.com" not in url:
        raise InvalidURLError(f"URL nao e do Instagram: {url}")


def _check_video_availability(info: dict) -> None:
    is_private = info.get("is_private")
    availability = info.get("availability")
    if is_private or availability in {"private", "needs_auth"}:
        raise PrivateOrUnavailableError("Video privado ou requer login.")


def _try_download_audio(url: str) -> str | None:
    try:
        return download_audio(url)
    except AudioUnavailableError:
        return None


def fetch_youtube(url: str) -> RawContent:
    _validate_youtube_url(url)

    try:
        with yt_dlp.YoutubeDL(_create_ydl_options()) as ydl:
            info = ydl.extract_info(url, download=False)

        _check_video_availability(info)

        subtitles_text = _get_yt_transcript(url) or _extract_caption_text(info)

        return RawContent(
            platform="youtube",
            url=url,
            title=info.get("title") or "Sem titulo",
            caption=info.get("description"),
            transcript=None,
            subtitles=subtitles_text,
            transcript_source=None,
            audio_path=_try_download_audio(url),
            thumbnail_url=_extract_thumbnail(info),
            author=info.get("uploader"),
        )

    except (PrivateOrUnavailableError, InvalidURLError):
        raise
    except yt_dlp.utils.DownloadError as error:
        raise FetchFailedError(f"Erro ao baixar video: {error}") from error
    except (ConnectionError, TimeoutError) as error:
        raise FetchFailedError(f"Erro de rede ao coletar video: {error}") from error


def fetch_instagram(url: str) -> RawContent:
    _validate_instagram_url(url)

    try:
        opts = _create_ydl_options()
        opts["writethumbnail"] = True

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)

        if not info:
            raise PrivateOrUnavailableError("Post privado ou nao disponivel")

        return RawContent(
            platform="instagram",
            url=url,
            title=info.get("title") or "Sem titulo",
            caption=info.get("description"),
            transcript=None,
            subtitles=None,
            transcript_source=None,
            audio_path=_try_download_audio(url),
            thumbnail_url=_extract_thumbnail(info),
            author=info.get("uploader") or info.get("channel") or "Desconhecido",
        )

    except (PrivateOrUnavailableError, InvalidURLError):
        raise
    except yt_dlp.utils.DownloadError as error:
        raise FetchFailedError(f"Erro ao baixar video: {error}") from error
    except (ConnectionError, TimeoutError) as error:
        raise FetchFailedError(f"Erro de rede ao coletar video: {error}") from error


def _pick_caption_source(submap: dict | None) -> CaptionSource | None:
    if not submap:
        return None

    for lang in PRIORITY_LANGUAGES:
        entries = submap.get(lang)
        if not entries:
            continue

        vtt_entry = _find_vtt_entry(entries)
        if vtt_entry:
            return CaptionSource(url=vtt_entry, language=lang, extension="vtt")

    return None


def _find_vtt_entry(entries: list) -> str | None:
    for item in entries:
        if item.get("ext") == "vtt" and item.get("url"):
            return item.get("url")
    return None


def _is_vtt_content_line(line: str) -> bool:
    if not line:
        return False
    if line.startswith(VTT_SKIP_PREFIXES):
        return False
    if "-->" in line:
        return False
    if line.isdigit():
        return False
    return True


def _vtt_to_plain_text(content: str) -> str:
    in_note_block = False
    text_lines: list[str] = []

    for raw_line in content.splitlines():
        stripped = raw_line.strip()

        if in_note_block:
            if not stripped:
                in_note_block = False
            continue

        if stripped.startswith("NOTE"):
            in_note_block = True
            continue

        if not _is_vtt_content_line(stripped):
            continue

        cleaned = VTT_TAG_PATTERN.sub("", stripped).strip()
        if cleaned:
            text_lines.append(cleaned)

    joined = " ".join(text_lines)
    return WHITESPACE_PATTERN.sub(" ", joined).strip()


def _download_vtt_as_text(url: str, timeout: float = 15.0) -> str:
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.get(url)
            response.raise_for_status()
            return _vtt_to_plain_text(response.text)
    except httpx.TimeoutException as error:
        raise NetworkTimeoutError(url, timeout) from error
    except httpx.HTTPStatusError as error:
        raise FetchFailedError(f"HTTP error downloading VTT: {error}") from error


def _extract_caption_text(info: dict) -> str | None:
    caption_keys = ("subtitles", "automatic_captions")

    for key in caption_keys:
        source = _pick_caption_source(info.get(key))
        if not source:
            continue

        try:
            return _download_vtt_as_text(source.url)
        except (NetworkTimeoutError, FetchFailedError):
            continue

    return None


def _extract_video_id(url: str) -> str | None:
    match = YOUTUBE_VIDEO_ID_PATTERN.search(url)
    return match.group(1) if match else None


def _fetch_transcript_data(video_id: str) -> list[dict] | None:
    try:
        return YouTubeTranscriptApi.get_transcript(video_id, languages=list(PRIORITY_LANGUAGES))
    except AttributeError:
        return _fetch_transcript_via_instance(video_id)
    except (TranscriptsDisabled, NoTranscriptFound):
        return None
    except (ConnectionError, TimeoutError) as error:
        logger.warning("Network error fetching transcript: %s", error)
        return None


def _fetch_transcript_via_instance(video_id: str) -> list[dict] | None:
    try:
        transcript_list = YouTubeTranscriptApi().fetch(video_id, languages=list(PRIORITY_LANGUAGES))
        return transcript_list.to_raw_data() if hasattr(transcript_list, "to_raw_data") else None
    except (TranscriptsDisabled, NoTranscriptFound):
        return None
    except (ConnectionError, TimeoutError) as error:
        logger.warning("Network error fetching transcript: %s", error)
        return None


def _get_yt_transcript(url: str) -> str | None:
    video_id = _extract_video_id(url)
    if not video_id:
        return None

    data = _fetch_transcript_data(video_id)
    if not data:
        return None

    if hasattr(data, "to_raw_data"):
        data = data.to_raw_data()

    text_parts = [
        item.get("text", "").strip()
        for item in data
        if item.get("text")
    ]

    full_text = " ".join(text_parts).strip()
    return full_text or None


def download_audio(url: str) -> str | None:
    audio_dir = Path("data/audio")
    audio_dir.mkdir(parents=True, exist_ok=True)

    opts = _create_ydl_options(download=True, audio_only=True)
    opts["outtmpl"] = str(audio_dir / "%(id)s.%(ext)s")

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info_audio = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as error:
        raise AudioUnavailableError(f"Erro ao baixar audio: {error}") from error
    except (ConnectionError, TimeoutError) as error:
        raise AudioUnavailableError(f"Erro de rede ao baixar audio: {error}") from error

    return _extract_audio_filepath(info_audio)


def _extract_audio_filepath(info: dict) -> str | None:
    requested = info.get("requested_downloads")
    if requested:
        first = requested[0]
        return first.get("filepath") or first.get("filename")
    return info.get("filepath") or info.get("_filename")
