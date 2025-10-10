from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Optional

logger = logging.getLogger(__name__)

if TYPE_CHECKING:  # pragma: no cover - apenas para type-checkers
    from faster_whisper import WhisperModel
else:  # pragma: no cover - em runtime importamos de forma preguiçosa
    WhisperModel = "WhisperModel"  # type: ignore[assignment]


_model: Optional["WhisperModel"] = None
_model_error: Exception | None = None


def _get_model() -> Optional["WhisperModel"]:
    """Carrega o modelo de forma preguiçosa.

    Caso o pacote `faster-whisper` não esteja disponível (por exemplo, em
    ambientes sem dependências de FFmpeg instaladas), registramos um aviso e
    retornamos ``None`` para que a chamada de transcrição seja ignorada.
    """

    global _model, _model_error

    if _model is not None:
        return _model

    if _model_error is not None:
        logger.debug("Faster-whisper indisponível: %s", _model_error)
        return None

    try:
        from faster_whisper import WhisperModel as _WhisperModel  # type: ignore
    except ImportError as exc:  # pragma: no cover - comportamento dependente do deploy
        _model_error = exc
        logger.info(
            "Biblioteca optional 'faster-whisper' nao encontrada. Pulei a transcricao de audio."
        )
        return None

    try:
        # ``compute_type='auto'`` escolhe automaticamente o modo suportado pelo
        # ambiente (CPU/GPU) sem exigir float16.
        _model = _WhisperModel("medium", compute_type="auto")
    except Exception as exc:  # pragma: no cover - erros de inicialização raros
        _model_error = exc
        logger.warning("Falha ao inicializar faster-whisper: %s", exc)
        return None

    return _model


def transcribe_audio(path: str, language: str | None = "pt") -> str:
    """Transcreve um arquivo de áudio para texto.

    Se o modelo não estiver disponível (por exemplo, porque a dependência é
    opcional no ambiente de deploy), retornamos uma string vazia para que o
    fluxo de ingestão continue utilizando legendas ou captions quando houver.
    """

    model = _get_model()
    if model is None:
        return ""

    segments, _info = model.transcribe(  # type: ignore[call-arg]
        path,
        language=language,
        vad_filter=True,
        beam_size=5,
    )

    parts: list[str] = []
    for seg in segments:
        t = seg.text.strip()
        if t:
            parts.append(t)
    return " ".join(parts).strip()
