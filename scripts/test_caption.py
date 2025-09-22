import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.services.fetcher import fetch_instagram

URL = "https://www.instagram.com/p/C4stLiBL4SS/"  # coloque um post ou reel público

rc = fetch_instagram(URL)
print("platform:", rc.platform)
print("title:", rc.title)
print("author:", rc.author)
print("has_description:", bool(rc.description))
print("desc_preview:", (rc.description or "")[:160])
print("audio_path:", rc.audio_path)


