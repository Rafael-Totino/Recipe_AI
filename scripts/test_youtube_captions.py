import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.services.fetcher import fetch_youtube

URL = "https://www.youtube.com/watch?v=_nJw6nnQms8"  # ex.: https://www.youtube.com/watch?v=...

rc = fetch_youtube(URL)
print("title:", rc.title)
print("has_description:", bool(rc.description))
print("has_caption_text:", bool(rc.caption_text))
print("caption_len:", len(rc.caption_text) if rc.caption_text else 0)
print("caption_preview:", rc.caption_text[:200] if rc.caption_text else "")
