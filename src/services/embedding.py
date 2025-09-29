import os, json
import google.generativeai as genai
from dotenv import load_dotenv, find_dotenv
from google.genai.errors import ClientError
from src.services.errors import RateLimitedError
from src.services.Prompt import *

def embedding_document(metadata: str) -> list[float]:

    try:
        genai.configure(api_key=get_api_key("GEMINI_API_KEY"))
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=metadata,
            task_type="RETRIEVAL_DOCUMENT"
        )
        
        return result['embedding']
    
    except ClientError as err:
        status_code = getattr(err, "status_code", None)
        message = str(err)
        if status_code == 429 or "RESOURCE_EXHAUSTED" in message:
            raise RateLimitedError(
                "Limite da API do Gemini atingido. Tente novamente em alguns instantes."
            ) from err
        raise
    
def embedding_query(metadata: str) -> list[float]:

    try:
        genai.configure(api_key=get_api_key("GEMINI_API_KEY"))
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=metadata,
            task_type="RETRIEVAL_QUERY"
        )
        
        return result['embedding']
    
    except ClientError as err:
        status_code = getattr(err, "status_code", None)
        message = str(err)
        if status_code == 429 or "RESOURCE_EXHAUSTED" in message:
            raise RateLimitedError(
                "Limite da API do Gemini atingido. Tente novamente em alguns instantes."
            ) from err
        raise
    
def stringify_payload(payload: dict) -> str:
    if not isinstance(payload, dict):
        return str(payload)
    lines = []
    # Raw content
    raw = payload.get("raw_content")
    if raw:
        lines.append("## Fonte Original")
        for k, v in raw.__dict__.items():
            lines.append(f"{k}: {v}")
    # Metadata (parse se for string)
    metadata = payload.get("metadata")
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except Exception:
            pass
    if isinstance(metadata, dict):
        lines.append("## Metadata")
        for k, v in metadata.items():
            if isinstance(v, dict):
                lines.append(f"{k}:")
                for kk, vv in v.items():
                    lines.append(f"  {kk}: {vv}")
            elif isinstance(v, list):
                lines.append(f"{k}: {', '.join(str(x) for x in v)}")
            else:
                lines.append(f"{k}: {v}")
    # Outros campos
    for k, v in payload.items():
        if k not in ("raw_content", "metadata"):
            lines.append(f"{k}: {v}")
    return "\n".join(lines)