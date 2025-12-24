from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from src.app.domain.errors import TranscriptionProcessingError, InvalidMediaError
from src.app.domain.models import TranscriptionResult, TranscriptionSegment

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
                logger.debug("CUDA DLL path added: %s", _cuda_path)
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
            logger.info("CUDA detected (%s), using GPU with float16", gpu_name)
            _device_info = ("cuda", "float16")
            return _device_info
    except ImportError:
        logger.debug("PyTorch not available for CUDA detection")
    except RuntimeError as cuda_error:
        logger.debug("Error detecting CUDA via PyTorch: %s", cuda_error)

    try:
        import ctranslate2
        cuda_types = ctranslate2.get_supported_compute_types("cuda")
        if "float16" in cuda_types:
            logger.info("CUDA detected via ctranslate2, using GPU with float16")
            _device_info = ("cuda", "float16")
            return _device_info
    except (ImportError, RuntimeError) as ct2_error:
        logger.debug("Error detecting CUDA via ctranslate2: %s", ct2_error)

    logger.info("GPU not available, using CPU with int8 (quantized)")
    _device_info = ("cpu", "int8")
    return _device_info


def _get_model() -> WhisperModel | None:
    global _model, _model_error

    if _model is not None:
        return _model

    if _model_error is not None:
        logger.debug("faster-whisper unavailable: %s", _model_error)
        return None

    try:
        from faster_whisper import WhisperModel as _WhisperModel
    except ImportError as import_error:
        _model_error = import_error
        logger.warning(
            "Optional 'faster-whisper' library not found. Audio transcription disabled."
        )
        return None

    try:
        device, compute_type = _detect_device()

        logger.info(
            "Initializing faster-whisper: model=%s, device=%s, compute_type=%s",
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

        logger.info("faster-whisper model initialized successfully")

    except RuntimeError as runtime_error:
        _model_error = runtime_error
        logger.error("Failed to initialize faster-whisper: %s", runtime_error)
        return None

    return _model


class TranscriptionPipeline:
    def __init__(self, language: str = "pt"):
        self.language = language
        self.model_version = WHISPER_MODEL

    def transcribe(self, media_path: Path) -> TranscriptionResult:
        if not media_path.exists():
            raise InvalidMediaError(f"Media file not found: {media_path}")

        model = _get_model()
        if model is None:
            raise TranscriptionProcessingError(
                "Whisper model not available",
                retryable=False,
            )

        try:
            logger.info("Starting transcription: path=%s, language=%s", media_path, self.language)

            segments_iter, info = model.transcribe(
                str(media_path),
                language=self.language,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=200,
                ),
                beam_size=WHISPER_BEAM_SIZE,
                condition_on_previous_text=False,
                word_timestamps=False,
            )

            segments: list[TranscriptionSegment] = []
            text_parts: list[str] = []

            for seg in segments_iter:
                text = seg.text.strip()
                if text:
                    segments.append(TranscriptionSegment(
                        start=seg.start,
                        end=seg.end,
                        text=text,
                    ))
                    text_parts.append(text)

            full_text = " ".join(text_parts).strip()
            duration_sec = info.duration if hasattr(info, 'duration') else 0
            detected_language = info.language if hasattr(info, 'language') else self.language

            result = TranscriptionResult(
                text=full_text,
                segments=segments,
                language=detected_language,
                duration_sec=duration_sec,
                model_version=self.model_version,
            )

            logger.info(
                "Transcription complete: duration=%.1fs, segments=%d, chars=%d, language=%s",
                duration_sec,
                len(segments),
                len(full_text),
                detected_language,
            )

            return result

        except (RuntimeError, ValueError) as transcription_error:
            logger.error("Transcription failed: %s", transcription_error)
            raise TranscriptionProcessingError(
                f"Transcription failed: {transcription_error}",
                retryable=True,
            ) from transcription_error

    def get_model_info(self) -> dict[str, str | bool]:
        model = _get_model()
        if model is None:
            return {
                "available": False,
                "error": str(_model_error) if _model_error else "Model not loaded",
            }

        device, compute_type = _detect_device()
        return {
            "available": True,
            "model": self.model_version,
            "device": device,
            "compute_type": compute_type,
        }


def transcribe_file(path: str, language: str = "pt") -> str:
    pipeline = TranscriptionPipeline(language=language)
    try:
        result = pipeline.transcribe(Path(path))
        return result.text
    except (TranscriptionProcessingError, InvalidMediaError) as transcription_error:
        logger.error("Transcription failed: %s", transcription_error)
        return ""
