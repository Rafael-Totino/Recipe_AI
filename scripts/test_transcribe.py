import argparse
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.services.ingest import should_transcribe_content
from src.services.transcribe import transcribe_audio


def main() -> None:
    parser = argparse.ArgumentParser(description="Quick transcription smoke test")
    parser.add_argument("audio", nargs="?", default="data/C4stLiBL4SS.m4a")
    parser.add_argument("--language", default="pt")
    parser.add_argument("--transcript", default="")
    parser.add_argument("--subtitles", default="")
    parser.add_argument("--min-chars", type=int, default=32)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    needs_transcription = should_transcribe_content(
        args.transcript,
        args.subtitles,
        args.min_chars,
    )

    print("should_transcribe:", needs_transcription)
    if not (needs_transcription or args.force):
        print(
            "Skipping transcribe_audio: transcript/subtitles already satisfy the minimum length.",
        )
        return

    txt = transcribe_audio(args.audio, language=args.language)
    print("chars:", len(txt))
    print("preview:", txt[:200])


if __name__ == "__main__":
    main()
