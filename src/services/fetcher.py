import yt_dlp, re
from src.services.types import *
from src.services.errors import *
from typing import Optional, Tuple
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound


def fetch_youtube(url: str) -> RawContent:
    # 1. Validar URL (se não for do YouTube, erro)
    if "youtube.com" not in url and "youtu.be" not in url:
        raise InvalidURLError(f"URL não é do YouTube: {url}")

    try:
        ydl_opts = {
            "quiet": True,         # sem logs barulhentos
            "noprogress": True,
            "skip_download": True, # só metadados
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        # checagens simples de disponibilidade
        if info.get("is_private") or info.get("availability") in {"private", "needs_auth"}:
            raise PrivateOrUnavailableError("Vídeo privado ou requer login.")

        # 3. Montar objeto RawContent (placeholder)
        content = RawContent(
            platform="youtube",
            url=url,
            title=info.get("title", "Sem título"),
            description=info.get("description"),
            caption_text=_get_yt_transcript(url),   # depois tentamos legendas
            audio_path=None,     # depois tentamos baixar áudio
            thumbnail_url=info.get("thumbnail"),
            author=info.get("uploader"),
        )

        # 4. Se não houver texto suficiente → precisamos de áudio
        if not content.description and not content.caption_text:
            # (depois implementamos o download do áudio)
            raise AudioUnavailableError("Não foi possível obter áudio para transcrição.")

        return content

    except Exception as e:
        # genérico — se não for uma das exceções tratadas, mapeamos como falha de fetch
        raise FetchFailedError(f"Erro inesperado ao coletar vídeo: {e}")



def _pick_caption_text(submap: dict) -> Optional[Tuple[str, str, str]]:
    if not submap:
        return None
    langs_priority = ["pt-BR", "pt", "en"]
    ext_priority = ["vtt"]  # preferir VTT
    for lang in langs_priority:
        if lang in submap and submap[lang]:
            for ext in ext_priority:
                for item in submap[lang]:
                    if item.get("ext") == ext and "url" in item:
                        url = item.get("url")
                        return url, lang, ext
    return None



def _vtt_to_plain_text_str(content: str) -> str:
    
    _TAG_RE = re.compile(r"<[^>]+>")  # remove tags <b>, <i>, <c>, etc.
    
    """
    Converte conteúdo WebVTT em texto simples (sem timestamps, sem tags).
    """
    lines_out = []
    in_note = False

    for raw in content.splitlines():
        # Se estamos dentro de um bloco NOTE, ignorar até linha em branco
        if in_note:
            if raw.strip() == "":
                in_note = False
            continue

        line = raw.strip()

        # Ignora vazias
        if line == "":
            continue
        # Cabeçalho
        if line == "WEBVTT":
            continue
        # Início de bloco NOTE/STYLE/REGION
        if line.startswith("NOTE"):
            in_note = True
            continue
        if line.startswith("STYLE") or line.startswith("REGION"):
            continue
        # Timestamps
        if "-->" in line:
            continue
        # Números de sequência
        if line.isdigit():
            continue

        # Remove tags simples
        line = _TAG_RE.sub("", line).strip()
        if line:
            lines_out.append(line)

    # Normaliza espaços e junta
    text = " ".join(lines_out)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def _download_vtt_as_text(url: str, timeout: float = 15.0) -> str:
    
    import httpx
    """
    Baixa um .vtt por URL e devolve seu texto puro.
    """
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        r = client.get(url)
        r.raise_for_status()
        # httpx já tenta detectar encoding; se quebrar, poderíamos forçar UTF-8
        vtt_content = r.text
    return _vtt_to_plain_text_str(vtt_content)

def _extract_caption_text(url: str, info: dict) -> Optional[str]:
    
    
    caption_from_api = _get_yt_transcript(url)
    if caption_from_api:
        return caption_from_api
    """
    Dado o dict retornado pelo yt-dlp (info),
    tenta pegar legendas (subtitles ou automatic_captions),
    baixar o .vtt e converter para texto puro.
    """
    capt = _pick_caption_text(info.get("subtitles")) or _pick_caption_text(info.get("automatic_captions"))
    if capt:
        url, lang = capt
        return _download_vtt_as_text(url)
    return None

def _get_yt_transcript(url: str) -> Optional[str]:
    """
    Tenta obter a transcrição de um vídeo do YouTube (PT > EN).
    Retorna texto limpo ou None.
    """
    # extrair video_id com regex
    match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
    if not match:
        return None
    video_id = match.group(1)

    try:
        fetched_transcript = YouTubeTranscriptApi().fetch(video_id, languages=["pt-BR", "pt", "en"])
        
        data = fetched_transcript.to_raw_data() # lista de dicts com 'text', 'start', 'duration'                                                                                                                                                                                        

    except (TranscriptsDisabled, NoTranscriptFound):
        return None
    except Exception as e:
        print("Erro inesperado:", e)
        return None
    
    full_text = " ".join(ch["text"] for ch in data if ch["text"].strip())
    return full_text.strip() or None
