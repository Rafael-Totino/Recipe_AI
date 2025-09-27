import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.services.ingest import ingest

URLS = [
    # coloque 1 YouTube e 1 Instagram publicos
    "https://www.youtube.com/watch?v=_nJw6nnQms8",
    "https://www.instagram.com/p/C4stLiBL4SS/",
]

for url in URLS:
    print("\n===", url)
    result = ingest(url)
    raw = result["raw_content"]
    print("platform:", raw.platform)
    print("title:", raw.title)
    print("has_caption:", bool(raw.caption))
    print("has_transcript:", bool(raw.transcript))
    print("caption_preview:", (raw.caption or "")[:120])
    print("transcript_preview:", (raw.transcript or "")[:120])
    print("ai_keys:", list((result.get("recipe_data") or {}).keys()))
