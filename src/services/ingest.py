from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from src.services.types import RawContent
from src.services.fetcher import fetch_instagram, fetch_youtube
from src.services.transcribe import transcribe_audio
from src.services.errors import FetchFailedError, UnsupportedPlatformError, RateLimitedError, TranscriptionServiceError
from src.services.ids import detect_platform
from src.services.Prompt import run_recipe_agent

DEFAULT_TRANSCRIPT_MIN_CHARS = 32
TRANSCRIPTS_DIR = Path("data/transcripts")

PLATFORM_FETCHERS = {
    "youtube": fetch_youtube,
    "instagram": fetch_instagram,
}


@dataclass
class TranscriptInfo:
    text: str
    source: str


def _get_best_transcript(content: RawContent) -> str | None:
    if content.transcript:
        return content.transcript.strip()
    if content.subtitles:
        return content.subtitles.strip()
    return None


def _build_agent_payload(content: RawContent) -> dict[str, str | None]:
    transcript_value = _get_best_transcript(content)

    return {
        "platform": content.platform,
        "videoTitle": content.title or "",
        "videoAuthor": content.author,
        "sourceUrl": content.url,
        "thumbnailUrl": content.thumbnail_url,
        "captions": content.caption,
        "transcript": transcript_value,
        "transcriptSource": content.transcript_source,
    }


def _persist_audio_transcript(text: str, audio_path: str | None) -> None:
    try:
        TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
        base_name = Path(audio_path).stem if audio_path else "transcript"
        output_path = TRANSCRIPTS_DIR / f"{base_name}.txt"
        output_path.write_text(text, encoding="utf-8")
    except OSError:
        pass


def _format_text_section(header: str, text: str | None) -> str | None:
    if not text:
        return None
    stripped = text.strip()
    return f"## {header}\n{stripped}" if stripped else None


def _build_raw_text(caption: str | None, transcript: str | None, subtitles: str | None) -> str:
    sections = [
        _format_text_section("CAPTION", caption),
        _format_text_section("TRANSCRIPT", transcript),
    ]

    if subtitles and _should_include_subtitles(subtitles, transcript):
        sections.append(_format_text_section("SUBTITLES", subtitles))

    return "\n\n".join(s for s in sections if s)


def _should_include_subtitles(subtitles: str, transcript: str | None) -> bool:
    subtitles_text = subtitles.strip()
    if not transcript:
        return bool(subtitles_text)
    return subtitles_text != transcript.strip()


def _compose_metadata(
    content: RawContent,
    ai_recipe: dict[str, str | list | dict],
) -> dict[str, dict[str, str | None] | str]:
    return {
        "media": {
            "thumbnail_url": content.thumbnail_url,
            "author": content.author,
            "platform": content.platform,
            "url": content.url,
        },
        "provenance": {
            "audio_path_local": content.audio_path,
            "transcript_source": content.transcript_source,
        },
        "raw_text": _build_raw_text(content.caption, content.transcript, content.subtitles),
        "raw_text_sections": {
            "caption": content.caption,
            "transcript": content.transcript,
            "subtitles": content.subtitles,
        },
        "ai_recipe": ai_recipe,
    }


def _has_sufficient_text(text: str | None, min_chars: int) -> bool:
    if not text:
        return False
    return len(text.strip()) >= min_chars


def should_transcribe_content(
    transcript: str | None,
    subtitles: str | None,
    min_chars: int = DEFAULT_TRANSCRIPT_MIN_CHARS,
) -> bool:
    effective_min = max(0, min_chars)

    if effective_min == 0:
        return not (transcript or subtitles)

    has_transcript = _has_sufficient_text(transcript, effective_min)
    has_subtitles = _has_sufficient_text(subtitles, effective_min)

    return not has_transcript and not has_subtitles


def _fetch_content(url: str) -> RawContent:
    platform = detect_platform(url)
    fetcher = PLATFORM_FETCHERS.get(platform)

    if not fetcher:
        raise UnsupportedPlatformError("Plataforma nao suportada")

    return fetcher(url)


def _try_audio_transcription(content: RawContent) -> TranscriptInfo | None:
    if not content.audio_path:
        return None

    try:
        audio_transcript = transcribe_audio(content.audio_path, language="pt")
    except TranscriptionServiceError:
        return None

    if not audio_transcript:
        return None

    stripped = audio_transcript.strip()
    if not stripped:
        return None

    return TranscriptInfo(text=stripped, source="audio")


def _apply_transcription(content: RawContent, transcript_info: TranscriptInfo) -> None:
    content.transcript = transcript_info.text
    content.transcript_source = transcript_info.source
    _persist_audio_transcript(transcript_info.text, content.audio_path)


def _fallback_to_subtitles(content: RawContent) -> None:
    if content.transcript:
        return

    if not content.subtitles:
        return

    subtitle_text = content.subtitles.strip()
    if not subtitle_text:
        return

    content.transcript = subtitle_text
    if not content.transcript_source:
        content.transcript_source = "subtitles"


def _validate_content_has_text(content: RawContent) -> None:
    if not content.caption and not content.transcript:
        raise FetchFailedError("Sem caption e sem transcript - nada para extrair.")


def _run_ai_extraction(content: RawContent) -> dict:
    try:
        agent_payload = _build_agent_payload(content)
        return run_recipe_agent(agent_payload)
    except RateLimitedError:
        raise
    except (ValueError, TypeError, IOError) as error:
        raise FetchFailedError(f"Falha ao interpretar conteudo com IA: {error}") from error


def _needs_transcription(content: RawContent, force: bool, min_chars: int) -> bool:
    if not content.audio_path:
        return False

    if force:
        return True

    return should_transcribe_content(content.transcript, content.subtitles, min_chars)


def ingest(
    url: str,
    *,
    force_transcription: bool = False,
    transcript_min_chars: int = DEFAULT_TRANSCRIPT_MIN_CHARS,
) -> dict[str, RawContent | dict]:
    content = _fetch_content(url)

    if _needs_transcription(content, force_transcription, transcript_min_chars):
        transcript_info = _try_audio_transcription(content)
        if transcript_info:
            _apply_transcription(content, transcript_info)
        elif not (content.caption or content.transcript or content.subtitles):
            raise FetchFailedError("Falha ao transcrever audio sem fallback disponivel")

    _fallback_to_subtitles(content)
    _validate_content_has_text(content)

    structured_recipe = _run_ai_extraction(content)
    metadata = _compose_metadata(content, structured_recipe)

    return {
        "raw_content": content,
        "metadata": metadata,
    }
