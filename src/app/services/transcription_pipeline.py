# src/app/services/transcription_pipeline.py
"""
Pure business logic for transcription.
This module has no infrastructure dependencies - only domain models.
"""
from __future__ import annotations

import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from src.app.domain.errors import TranscriptionProcessingError, InvalidMediaError
from src.app.domain.models import TranscriptionResult, TranscriptionSegment

logger = logging.getLogger(__name__)

# =============================================================================
# Configuration via environment variables
# =============================================================================
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "medium")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")  # auto, cuda, cpu
WHISPER_BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "5"))

# =============================================================================
# Windows CUDA DLL path setup
# =============================================================================
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
            except Exception:
                pass

if TYPE_CHECKING:
    from faster_whisper import WhisperModel
else:
    WhisperModel = "WhisperModel"  # type: ignore


# Module-level state
_model: Optional["WhisperModel"] = None
_model_error: Optional[Exception] = None
_device_info: Optional[tuple[str, str]] = None


def _detect_device() -> tuple[str, str]:
    """
    Detect the best device and compute_type for the environment.
    
    Returns:
        Tuple of (device, compute_type)
    """
    global _device_info
    
    if _device_info is not None:
        return _device_info
    
    # Explicit configuration via ENV
    if WHISPER_DEVICE == "cuda":
        _device_info = ("cuda", "float16")
        return _device_info
    if WHISPER_DEVICE == "cpu":
        _device_info = ("cpu", "int8")
        return _device_info
    
    # Auto-detect CUDA
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            logger.info("CUDA detected (%s), using GPU with float16", gpu_name)
            _device_info = ("cuda", "float16")
            return _device_info
    except ImportError:
        logger.debug("PyTorch not available for CUDA detection")
    except Exception as exc:
        logger.debug("Error detecting CUDA via PyTorch: %s", exc)
    
    # Fallback: try ctranslate2 direct detection
    try:
        import ctranslate2
        cuda_types = ctranslate2.get_supported_compute_types("cuda")
        if "float16" in cuda_types:
            logger.info("CUDA detected via ctranslate2, using GPU with float16")
            _device_info = ("cuda", "float16")
            return _device_info
    except Exception as exc:
        logger.debug("Error detecting CUDA via ctranslate2: %s", exc)
    
    logger.info("GPU not available, using CPU with int8 (quantized)")
    _device_info = ("cpu", "int8")
    return _device_info


def _get_model() -> Optional["WhisperModel"]:
    """
    Lazily load the Whisper model with optimizations.
    """
    global _model, _model_error
    
    if _model is not None:
        return _model
    
    if _model_error is not None:
        logger.debug("faster-whisper unavailable: %s", _model_error)
        return None
    
    try:
        from faster_whisper import WhisperModel as _WhisperModel
    except ImportError as exc:
        _model_error = exc
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
        
    except Exception as exc:
        _model_error = exc
        logger.error("Failed to initialize faster-whisper: %s", exc)
        return None
    
    return _model


class TranscriptionPipeline:
    """
    Pure business logic for transcription.
    
    This class handles the actual transcription process,
    isolated from infrastructure concerns (storage, queue, etc.)
    """
    
    def __init__(self, language: str = "pt"):
        self.language = language
        self.model_version = WHISPER_MODEL
    
    def transcribe(self, media_path: Path) -> TranscriptionResult:
        """
        Transcribe an audio/video file.
        
        Args:
            media_path: Path to the media file
            
        Returns:
            TranscriptionResult with text, segments, and metadata
            
        Raises:
            TranscriptionProcessingError: If transcription fails
            InvalidMediaError: If the file is invalid or unsupported
        """
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
                # VAD (Voice Activity Detection) - skip silences
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=200,
                ),
                # Optimized decoding parameters
                beam_size=WHISPER_BEAM_SIZE,
                condition_on_previous_text=False,
                word_timestamps=False,
            )
            
            # Collect segments
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
            
        except Exception as e:
            logger.error("Transcription failed: %s", e)
            raise TranscriptionProcessingError(
                f"Transcription failed: {e}",
                retryable=True,
            ) from e
    
    def get_model_info(self) -> dict:
        """Get information about the loaded model."""
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


# Convenience function for simple use cases
def transcribe_file(path: str, language: str = "pt") -> str:
    """
    Simple function to transcribe a file and return just the text.
    
    This is a compatibility wrapper for existing code that uses
    the old transcribe_audio function.
    """
    pipeline = TranscriptionPipeline(language=language)
    try:
        result = pipeline.transcribe(Path(path))
        return result.text
    except (TranscriptionProcessingError, InvalidMediaError) as e:
        logger.error("Transcription failed: %s", e)
        return ""
