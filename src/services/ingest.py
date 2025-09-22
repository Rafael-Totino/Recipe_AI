from src.services.types import RawContent
from src.services.fetcher import fetch_youtube, fetch_instagram
from src.services.transcribe import transcribe_audio
from src.services.errors import FetchFailedError, UnsupportedPlatformError

def ingest(url: str) -> RawContent:
    # 1) roteia por plataforma
    if "youtube.com" in url or "youtu.be" in url:
        content = fetch_youtube(url)
    elif "instagram.com" in url:
        content = fetch_instagram(url)
    else:
        raise UnsupportedPlatformError("Plataforma não suportada")

    # 2) se faltar transcript e houver áudio → transcreve
    if not content.transcript and content.audio_path:
        try:
            content.transcript = transcribe_audio(content.audio_path, language="pt")
        except Exception as e:
            # não derruba a ingestão se já houver caption útil
            if not content.caption:
                raise FetchFailedError(f"Falha ao transcrever áudio: {e}")

    # 3) última garantia: tem que vir algo útil
    if not content.caption and not content.transcript:
        raise FetchFailedError("Sem caption e sem transcript — nada para extrair.")

    return content
