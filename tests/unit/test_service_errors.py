from __future__ import annotations

import pytest

from src.services.errors import (
    ServiceError,
    InvalidURLError,
    UnsupportedPlatformError,
    PrivateOrUnavailableError,
    RateLimitedError,
    AudioUnavailableError,
    FetchFailedError,
    TranscriptionServiceError,
    NetworkTimeoutError,
)


class TestServiceError:
    def test_base_exception(self) -> None:
        error = ServiceError("Base service error")
        assert str(error) == "Base service error"
        assert isinstance(error, Exception)


class TestInvalidURLError:
    def test_invalid_url(self) -> None:
        error = InvalidURLError("Not a valid URL")
        assert "Not a valid URL" in str(error)
        assert isinstance(error, ServiceError)


class TestUnsupportedPlatformError:
    def test_unsupported_platform(self) -> None:
        error = UnsupportedPlatformError("TikTok not supported")
        assert "TikTok" in str(error)
        assert isinstance(error, ServiceError)


class TestPrivateOrUnavailableError:
    def test_private_content(self) -> None:
        error = PrivateOrUnavailableError("Video is private")
        assert "private" in str(error)
        assert isinstance(error, ServiceError)


class TestRateLimitedError:
    def test_rate_limited(self) -> None:
        error = RateLimitedError("Too many requests")
        assert "Too many requests" in str(error)
        assert isinstance(error, ServiceError)


class TestAudioUnavailableError:
    def test_audio_unavailable(self) -> None:
        error = AudioUnavailableError("Could not download audio")
        assert "audio" in str(error).lower()
        assert isinstance(error, ServiceError)


class TestFetchFailedError:
    def test_fetch_failed(self) -> None:
        error = FetchFailedError("Network error during fetch")
        assert "Network error" in str(error)
        assert isinstance(error, ServiceError)


class TestTranscriptionServiceError:
    def test_transcription_error(self) -> None:
        error = TranscriptionServiceError("Transcription failed")
        assert isinstance(error, ServiceError)


class TestNetworkTimeoutError:
    def test_timeout_with_url_and_seconds(self) -> None:
        error = NetworkTimeoutError("https://example.com/video", 15.0)
        assert "https://example.com/video" in str(error)
        assert "15" in str(error)
        assert error.url == "https://example.com/video"
        assert error.timeout_seconds == 15.0

    def test_inherits_from_service_error(self) -> None:
        error = NetworkTimeoutError("https://example.com", 10.0)
        assert isinstance(error, ServiceError)


class TestExceptionHierarchy:
    def test_all_errors_inherit_from_service_error(self) -> None:
        assert issubclass(InvalidURLError, ServiceError)
        assert issubclass(UnsupportedPlatformError, ServiceError)
        assert issubclass(PrivateOrUnavailableError, ServiceError)
        assert issubclass(RateLimitedError, ServiceError)
        assert issubclass(AudioUnavailableError, ServiceError)
        assert issubclass(FetchFailedError, ServiceError)
        assert issubclass(TranscriptionServiceError, ServiceError)
        assert issubclass(NetworkTimeoutError, ServiceError)
