import sys, time, pathlib, threading, subprocess, json
from statistics import mean
from typing import Optional

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# importa seu transcritor (reutiliza o modelo já carregado)
from src.services.transcribe import transcribe_audio, _get_model  # _get_model usado só para "aquecer"

# --- Utilitários de sistema ---
try:
    import pynvml  # nvidia-ml-py3
    NVML_OK = True
except Exception:
    NVML_OK = False

import psutil

def ffprobe_duration_seconds(audio_path: str) -> Optional[float]:
    """Usa ffprobe para obter a duração (s). Requer ffmpeg no PATH."""
    try:
        # Saída simples: só o número
        out = subprocess.check_output([
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path
        ], stderr=subprocess.STDOUT, text=True)
        return float(out.strip())
    except Exception:
        return None

class Sampler(threading.Thread):
    """Amostra GPU/RAM periodicamente enquanto a transcrição roda."""
    def __init__(self, interval=0.5):
        super().__init__(daemon=True)
        self.interval = interval
        self._stop = threading.Event()
        self.samples = []  # lista de dicts com métricas

        # NVML
        self.nvml = NVML_OK
        if self.nvml:
            try:
                pynvml.nvmlInit()
                self.handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            except Exception:
                self.nvml = False

    def run(self):
        while not self._stop.is_set():
            sample = {}

            # RAM do sistema
            vm = psutil.virtual_memory()
            sample["ram_percent"] = vm.percent

            # GPU (se NVML disponível)
            if self.nvml:
                try:
                    util = pynvml.nvmlDeviceGetUtilizationRates(self.handle)
                    mem = pynvml.nvmlDeviceGetMemoryInfo(self.handle)
                    temp = pynvml.nvmlDeviceGetTemperature(self.handle, pynvml.NVML_TEMPERATURE_GPU)

                    sample["gpu_util_percent"] = util.gpu
                    sample["gpu_mem_used_mb"] = int(mem.used / (1024**2))
                    sample["gpu_mem_total_mb"] = int(mem.total / (1024**2))
                    sample["gpu_temp_c"] = temp
                except Exception:
                    # falha eventual de leitura
                    pass

            self.samples.append(sample)
            time.sleep(self.interval)

    def stop(self):
        self._stop.set()
        self.join()
        if self.nvml:
            try:
                pynvml.nvmlShutdown()
            except Exception:
                pass

def summarize(samples):
    """Calcula picos e médias a partir das amostras."""
    if not samples:
        return {}

    def collect(key):
        return [s[key] for s in samples if key in s]

    ram = collect("ram_percent")
    util = collect("gpu_util_percent")
    mem = collect("gpu_mem_used_mb")
    temp = collect("gpu_temp_c")
    mem_total = None
    for s in samples:
        if "gpu_mem_total_mb" in s:
            mem_total = s["gpu_mem_total_mb"]
            break

    summary = {}
    if ram:
        summary["ram_peak_percent"] = max(ram)
        summary["ram_avg_percent"] = round(mean(ram), 1)

    if util:
        summary["gpu_util_peak_percent"] = max(util)
        summary["gpu_util_avg_percent"] = round(mean(util), 1)

    if mem:
        summary["gpu_mem_peak_mb"] = max(mem)
        if mem_total:
            summary["gpu_mem_peak_pct"] = round(100.0 * max(mem) / mem_total, 1)

    if temp:
        summary["gpu_temp_max_c"] = max(temp)
        summary["gpu_temp_avg_c"] = round(mean(temp), 1)

    return summary

if __name__ == "__main__":
    # === CONFIGURE AQUI ===
    AUDIO = "data/audio/_nJw6nnQms8.m4a"  # coloque o caminho gerado pelo fetcher
    LANGUAGE = "pt"  # YouTube pode ser None; Instagram geralmente "pt"

    # Duração do áudio, para calcular "real-time factor"
    dur = ffprobe_duration_seconds(AUDIO)

    # "Aquecimento" do modelo (não mede o tempo de load/download)
    _ = _get_model()

    # Amostragem enquanto transcreve
    sampler = Sampler(interval=0.5)
    sampler.start()
    t0 = time.time()
    text = transcribe_audio(AUDIO, language=LANGUAGE)
    dt = time.time() - t0
    sampler.stop()

    # Métricas
    chars = len(text)
    rtf = (dur / dt) if (dur and dt > 0) else None
    stats = summarize(sampler.samples)

    print("\n===== RESULTADO =====")
    print(f"arquivo: {AUDIO}")
    if dur is not None:
        print(f"duração áudio: {dur:.2f}s")
    print(f"tempo transcrição: {dt:.2f}s")
    if rtf:
        print(f"real-time factor (>(1)=mais rápido que tempo real): {rtf:.2f}")
    print(f"chars transcritos: {chars}")
    print(f"preview: {text[:160]!r}")

    print("\n===== SISTEMA =====")
    print(f"GPU disponível (NVML): {NVML_OK}")
    if stats:
        # imprime apenas as chaves que existirem
        for k in [
            "gpu_util_peak_percent","gpu_util_avg_percent",
            "gpu_mem_peak_mb","gpu_mem_peak_pct",
            "gpu_temp_max_c","gpu_temp_avg_c",
            "ram_peak_percent","ram_avg_percent"
        ]:
            if k in stats:
                print(f"{k}: {stats[k]}")