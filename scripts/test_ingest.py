import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.services.ingest import ingest

URLS = [
    # coloque 1 YouTube e 1 Instagram públicos
    "https://www.youtube.com/watch?v=_nJw6nnQms8",
    "https://www.instagram.com/p/C4stLiBL4SS/",
]

for u in URLS:
    print("\n===", u)
    rc = ingest(u)
    print("platform:", rc.platform)
    print("title:", rc.title)
    print("has_caption:", bool(rc.caption))
    print("has_transcript:", bool(rc.transcript))
    print("caption_preview:", (rc.caption or "")[:120])
    print("transcript_preview:", (rc.transcript or "")[:120])
