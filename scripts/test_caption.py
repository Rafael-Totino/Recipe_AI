# scripts/inspect_caption_track.py
import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import yt_dlp
from src.services.fetcher import _get_yt_transcript

URL = "https://www.youtube.com/watch?v=_nJw6nnQms8"

txt = _get_yt_transcript(URL)

print("Transcript size:", len(txt) if txt else 0)
print("Preview:", txt[:200] if txt else "None")

