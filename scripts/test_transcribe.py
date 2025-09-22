import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.services.transcribe import transcribe_audio

# coloque aqui o caminho de um .m4a que o fetch_instagram gerou
AUDIO = "data/C4stLiBL4SS.m4a"

txt = transcribe_audio(AUDIO, language="pt")
print("chars:", len(txt))
print("preview:", txt[:200])
