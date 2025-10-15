import argparse
import pathlib
import sys
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.services.ingest import ingest


def run_ingest(url: str, options: dict[str, Any]) -> None:
    print("\n===", url)
    print("options:", options)
    result = ingest(url, **options)
    raw = result["raw_content"]
    print("platform:", raw.platform)
    print("title:", raw.title)
    print("has_caption:", bool(raw.caption))
    print("has_transcript:", bool(raw.transcript))
    print("transcript_source:", raw.transcript_source)
    print("caption_preview:", (raw.caption or "")[:120])
    print("transcript_preview:", (raw.transcript or "")[:120])


def main() -> None:
    parser = argparse.ArgumentParser(description="Quick ingest smoke test")
    parser.add_argument("url", nargs="*", default=[
        "https://www.youtube.com/watch?v=_nJw6nnQms8",
        "https://www.instagram.com/p/C4stLiBL4SS/",
    ])
    parser.add_argument("--min-chars", type=int, default=32)
    parser.add_argument("--force", action="store_true")
    parser.add_argument(
        "--high-threshold",
        action="store_true",
        help="Run a second ingest forcing a very high minimum transcript size",
    )
    args = parser.parse_args()

    base_options = {
        "transcript_min_chars": args.min_chars,
        "force_transcription": args.force,
    }

    for url in args.url:
        run_ingest(url, base_options)
        if args.high_threshold:
            run_ingest(
                url,
                {
                    **base_options,
                    "transcript_min_chars": max(args.min_chars, 5000),
                },
            )


if __name__ == "__main__":
    main()
