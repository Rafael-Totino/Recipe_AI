from __future__ import annotations
from faster_whisper import WhisperModel

# Carregamos o modelo uma única vez (singleton simples)
# Sugestões:
# - "small" para começar (rápido e razoável)
# - "base" se sua máquina for bem modesta
# - "medium" se tiver CPU forte (ou GPU)
_model: WhisperModel | None = None

def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        # compute_type="int8" economiza memória em CPU
        _model = WhisperModel("small", compute_type="int8")
    return _model

def transcribe_audio(path: str, language: str | None = "pt") -> str:
    """
    Transcreve um arquivo de áudio para texto.
    - path: caminho do .m4a/.mp3/.wav
    - language: "pt" para forçar PT-BR; None para auto-detecção
    """
    model = _get_model()
    segments, info = model.transcribe(
        path,
        language=language,      # troque para None se preferir auto
        vad_filter=True,        # remove silêncios/ruído entre segmentos
        beam_size=5,            # um pouco mais estável que greedy
    )
    parts = []
    for seg in segments:
        t = seg.text.strip()
        if t:
            parts.append(t)
    return " ".join(parts).strip()
