class ServiceError(Exception):
    """Erro base para serviços do domínio (fetch/transcribe/extract)."""

class InvalidURLError(ServiceError):
    """URL malformada ou fora do escopo suportado."""

class UnsupportedPlatformError(ServiceError):
    """Plataforma não suportada por este fetcher."""

class PrivateOrUnavailableError(ServiceError):
    """Conteúdo privado, removido ou indisponível."""

class RateLimitedError(ServiceError):
    """Sinaliza limitação de taxa (bloqueio temporário da plataforma)."""

class AudioUnavailableError(ServiceError):
    """Áudio necessário para transcrição, mas não pôde ser obtido."""

class FetchFailedError(ServiceError):
    """Falha genérica ao coletar metadados/legendas/áudio."""
