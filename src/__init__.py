# src/__init__.py
import os, platform

# Ajuste o(s) caminho(s) conforme sua instalação
_CUDA_BINS = [
    r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin",
    # Deixe entradas extras se você por acaso mantiver o 13 instalado também:
    # r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.0\bin",
]

if platform.system() == "Windows":
    for p in _CUDA_BINS:
        if os.path.isdir(p):
            try:
                os.add_dll_directory(p)
            except Exception:
                pass
