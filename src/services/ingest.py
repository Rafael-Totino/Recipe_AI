from __future__ import annotations

from typing import Any, Dict, Tuple

from pathlib import Path

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


def ingest(url: str) -> Tuple[RawContent, str]:
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

    return content, structured_recipe
