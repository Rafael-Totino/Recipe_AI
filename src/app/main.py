# src/app/main.py
from __future__ import annotations
import logging, sys
from fastapi import FastAPI

# Logging simples no stdout (bom para dev e containers)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

app = FastAPI(title="Recipes AI API", version="0.1.0")

@app.get("/health")
def health():
    return {"ok": True}
