from __future__ import annotations

import logging
import os
import sys
from typing import TYPE_CHECKING

logger = logging.getLogger(__name__)

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "medium")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")
WHISPER_BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "5"))

if sys.platform == "win32":
    _cuda_paths = [
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.5\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.3\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.2\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.1\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.0\bin",
    ]
    for _cuda_path in _cuda_paths:
        if os.path.isdir(_cuda_path):
            try:
                os.add_dll_directory(_cuda_path)
                logger.debug("CUDA DLL path adicionado: %s", _cuda_path)
                break
            except OSError:
                pass

if TYPE_CHECKING:
    from faster_whisper import WhisperModel
else:
    WhisperModel = "WhisperModel"

_model: WhisperModel | None = None
_model_error: ImportError | RuntimeError | None = None
_device_info: tuple[str, str] | None = None


def _detect_device() -> tuple[str, str]:
    global _device_info

    if _device_info is not None:
        return _device_info

    if WHISPER_DEVICE == "cuda":
        _device_info = ("cuda", "float16")
        return _device_info
    if WHISPER_DEVICE == "cpu":
        _device_info = ("cpu", "int8")
        return _device_info

    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            logger.info("CUDA detectado (%s), usando GPU com float16", gpu_name)
            _device_info = ("cuda", "float16")
            return _device_info
    except ImportError:
        logger.debug("PyTorch não disponível para detecção de CUDA")
    except RuntimeError as cuda_error:
        logger.debug("Erro ao detectar CUDA via PyTorch: %s", cuda_error)

    try:
        import ctranslate2
        cuda_types = ctranslate2.get_supported_compute_types("cuda")
        if "float16" in cuda_types:
            logger.info("CUDA detectado via ctranslate2, usando GPU com float16")
            _device_info = ("cuda", "float16")
            return _device_info
    except (ImportError, RuntimeError) as ct2_error:
        logger.debug("Erro ao detectar CUDA via ctranslate2: %s", ct2_error)

    logger.info("GPU não disponível, usando CPU com int8 (quantizado)")
    _device_info = ("cpu", "int8")
    return _device_info


def _get_model() -> WhisperModel | None:
    global _model, _model_error

    if _model is not None:
        return _model

    if _model_error is not None:
        logger.debug("Faster-whisper indisponível: %s", _model_error)
        return None

    try:
        from faster_whisper import WhisperModel as _WhisperModel
    except ImportError as import_error:
        _model_error = import_error
        logger.info(
            "Biblioteca optional 'faster-whisper' nao encontrada. Pulei a transcricao de audio."
        )
        return None

    try:
        device, compute_type = _detect_device()

        logger.info(
            "Inicializando faster-whisper: model=%s, device=%s, compute_type=%s",
            WHISPER_MODEL,
            device,
            compute_type,
        )

        _model = _WhisperModel(
            WHISPER_MODEL,
            device=device,
            compute_type=compute_type,
            num_workers=2,
        )

        logger.info("Modelo faster-whisper inicializado com sucesso")

    except RuntimeError as runtime_error:
        _model_error = runtime_error
        logger.warning("Falha ao inicializar faster-whisper: %s", runtime_error)
        return None

    return _model


def transcribe_audio(path: str, language: str | None = "pt") -> str:
    model = _get_model()
    if model is None:
        return ""

    segments, _info = model.transcribe(
        path,
        language=language,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,
            speech_pad_ms=200,
        ),
        beam_size=WHISPER_BEAM_SIZE,
        condition_on_previous_text=False,
        word_timestamps=False,
    )

    parts: list[str] = []
    for seg in segments:
        t = seg.text.strip()
        if t:
            parts.append(t)
    return " ".join(parts).strip()
