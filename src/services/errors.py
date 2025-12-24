class ServiceError(Exception):
    pass


class InvalidURLError(ServiceError):
    pass


class UnsupportedPlatformError(ServiceError):
    pass


class PrivateOrUnavailableError(ServiceError):
    pass


class RateLimitedError(ServiceError):
    pass


class AudioUnavailableError(ServiceError):
    pass


class FetchFailedError(ServiceError):
    pass


class TranscriptionServiceError(ServiceError):
    pass


class NetworkTimeoutError(ServiceError):
    def __init__(self, url: str, timeout_seconds: float):
        super().__init__(f"Network timeout after {timeout_seconds}s: {url}")
        self.url = url
        self.timeout_seconds = timeout_seconds
