import os
# ajuste o caminho se o seu CUDA estiver em outra subpasta/versão
os.add_dll_directory(r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin")
from faster_whisper import WhisperModel
import time

try:
    model = WhisperModel("medium", device="cuda", compute_type="float16")
    t0 = time.time()
    segments, info = model.transcribe("data/C4stLiBL4SS.m4a", language="pt", vad_filter=True)
    txt = " ".join(seg.text for seg in segments)
    print("CUDA OK! chars:", len(txt), "tempo:", round(time.time()-t0, 2), "s")
except Exception as e:
    print("Falha no CUDA:", e)
