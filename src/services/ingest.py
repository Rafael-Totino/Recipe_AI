from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from src.services.types import RawContent
from src.services.fetcher import fetch_instagram, fetch_youtube
from src.services.transcribe import transcribe_audio
from src.services.errors import FetchFailedError, UnsupportedPlatformError, RateLimitedError
from src.services.ids import detect_platform
from src.services.Prompt import run_recipe_agent


def _build_agent_payload(content: RawContent) -> Dict[str, Any]:
    transcript_text = ""
    if content.transcript:
        transcript_text = content.transcript.strip()
    elif content.subtitles:
        transcript_text = content.subtitles.strip()

    transcript_value = transcript_text or None

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
    transcripts_dir = Path("data/transcripts")
    try:
        transcripts_dir.mkdir(parents=True, exist_ok=True)
        base_name = Path(audio_path).stem if audio_path else "transcript"
        output_path = transcripts_dir / f"{base_name}.txt"
        output_path.write_text(text, encoding="utf-8")
    except OSError:
        pass


def _build_raw_text(caption: str | None, transcript: str | None, subtitles: str | None) -> str:
    parts: list[str] = []
    if caption:
        caption_text = caption.strip()
        if caption_text:
            parts.append(f"## CAPTION\n{caption_text}")
    if transcript:
        transcript_text = transcript.strip()
        if transcript_text:
            parts.append(f"## TRANSCRIPT\n{transcript_text}")
    if subtitles:
        subtitles_text = subtitles.strip()
        if subtitles_text:
            if not transcript or subtitles_text != transcript.strip():
                parts.append(f"## SUBTITLES\n{subtitles_text}")
    return "\n\n".join(parts)


def _compose_metadata(content: RawContent, ai_recipe: Dict[str, Any]) -> Dict[str, Any]:
    raw_text_sections = {
        "caption": content.caption,
        "transcript": content.transcript,
        "subtitles": content.subtitles,
    }
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
        "raw_text_sections": raw_text_sections,
        "ai_recipe": ai_recipe,
    }


def ingest(url: str) -> Dict[str, Any]:
    platform = detect_platform(url)
    if platform == "youtube":
        content = fetch_youtube(url)
    elif platform == "instagram":
        content = fetch_instagram(url)
    else:
        raise UnsupportedPlatformError("Plataforma nao suportada")

    if content.audio_path:
        try:
            audio_transcript = transcribe_audio(content.audio_path, language="pt")
        except Exception as exc:
            if not (content.caption or content.transcript or content.subtitles):
                raise FetchFailedError(f"Falha ao transcrever audio: {exc}") from exc
        else:
            if audio_transcript:
                transcript_text = audio_transcript.strip()
                if transcript_text:
                    content.transcript = transcript_text
                    content.transcript_source = "audio"
                    _persist_audio_transcript(transcript_text, content.audio_path)

    if not content.transcript and content.subtitles:
        subtitle_text = content.subtitles.strip()
        if subtitle_text:
            content.transcript = subtitle_text
            if not content.transcript_source:
                content.transcript_source = "subtitles"

    if not (content.caption or content.transcript):
        raise FetchFailedError("Sem caption e sem transcript - nada para extrair.")

    try:
        agent_payload = _build_agent_payload(content)
        structured_recipe = run_recipe_agent(agent_payload)
    except RateLimitedError:
        raise
    except Exception as exc:
        raise FetchFailedError(f"Falha ao interpretar conteudo com IA: {exc}") from exc

    metadata = _compose_metadata(content, structured_recipe)

    return {
        "raw_content": content,
        "metadata": metadata,
    }
