from __future__ import annotations

import logging
import os
import sys
from typing import TYPE_CHECKING, Optional

logger = logging.getLogger(__name__)

# =============================================================================
# Configurações via variáveis de ambiente
# =============================================================================
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "medium")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")  # auto, cuda, cpu
WHISPER_BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "5"))

# =============================================================================
# Adiciona DLLs do CUDA no Windows (necessário para ctranslate2/faster-whisper)
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
                logger.debug("CUDA DLL path adicionado: %s", _cuda_path)
                break
            except Exception:
                pass

if TYPE_CHECKING:  # pragma: no cover - apenas para type-checkers
    from faster_whisper import WhisperModel
else:  # pragma: no cover - em runtime importamos de forma preguiçosa
    WhisperModel = "WhisperModel"  # type: ignore[assignment]


_model: Optional["WhisperModel"] = None
_model_error: Exception | None = None
_device_info: tuple[str, str] | None = None


def _detect_device() -> tuple[str, str]:
    """Detecta o melhor dispositivo e compute_type para o ambiente.
    
    Retorna:
        Tupla (device, compute_type) onde:
        - device: "cuda" ou "cpu"
        - compute_type: "float16" para GPU, "int8" para CPU
    """
    global _device_info
    
    if _device_info is not None:
        return _device_info
    
    # Configuração explícita via ENV
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
            logger.info("CUDA detectado (%s), usando GPU com float16", gpu_name)
            _device_info = ("cuda", "float16")
            return _device_info
    except ImportError:
        logger.debug("PyTorch não disponível para detecção de CUDA")
    except Exception as exc:
        logger.debug("Erro ao detectar CUDA via PyTorch: %s", exc)
    
    # Fallback: tentar detectar via ctranslate2 diretamente
    try:
        import ctranslate2
        cuda_types = ctranslate2.get_supported_compute_types("cuda")
        # Se float16 está disponível para device "cuda", é porque CUDA está funcionando
        if "float16" in cuda_types:
            logger.info("CUDA detectado via ctranslate2, usando GPU com float16")
            _device_info = ("cuda", "float16")
            return _device_info
    except Exception as exc:
        logger.debug("Erro ao detectar CUDA via ctranslate2: %s", exc)
    
    logger.info("GPU não disponível, usando CPU com int8 (quantizado)")
    _device_info = ("cpu", "int8")
    return _device_info


def _get_model() -> Optional["WhisperModel"]:
    """Carrega o modelo de forma preguiçosa com otimizações.

    Otimizações aplicadas:
    - Detecção automática de GPU (CUDA) ou CPU
    - compute_type="float16" para GPU (2-4x mais rápido, menor VRAM)
    - compute_type="int8" para CPU (menor uso de RAM)
    - Modelo configurável via WHISPER_MODEL env var
    
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
            num_workers=2,  # paralelismo no carregamento de dados
        )
        
        logger.info("Modelo faster-whisper inicializado com sucesso")
        
    except Exception as exc:  # pragma: no cover - erros de inicialização raros
        _model_error = exc
        logger.warning("Falha ao inicializar faster-whisper: %s", exc)
        return None

    return _model


def transcribe_audio(path: str, language: str | None = "pt") -> str:
    """Transcreve um arquivo de áudio para texto com otimizações.

    Otimizações aplicadas:
    - vad_filter: detecta e pula silêncios (mais rápido)
    - vad_parameters: configuração otimizada para detecção de fala
    - condition_on_previous_text=False: evita propagação de erros
    - word_timestamps=False: mais rápido (não precisa de timestamps por palavra)
    - beam_size configurável via WHISPER_BEAM_SIZE (default: 5)
    
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
        # VAD (Voice Activity Detection) - pula silêncios
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,  # silêncio mínimo para dividir segmentos
            speech_pad_ms=200,  # padding em torno da fala detectada
        ),
        # Parâmetros de decodificação otimizados
        beam_size=WHISPER_BEAM_SIZE,
        condition_on_previous_text=False,  # evita propagação de erros de transcrição
        word_timestamps=False,  # não precisamos de timestamps por palavra
    )

    parts: list[str] = []
    for seg in segments:
        t = seg.text.strip()
        if t:
            parts.append(t)
    return " ".join(parts).strip()
