import httpx
import os
from typing import Optional
from pydantic import BaseModel
from fastapi import HTTPException


class ProviderConfig(BaseModel):
    provider: str           # "ollama" | "openai"
    model: str
    base_url: Optional[str] = "http://localhost:11434"
    api_key: Optional[str] = None
    temperature: Optional[float] = 0.8
    max_tokens: Optional[int] = 2048


async def call_llm(
    provider: ProviderConfig,
    messages: list,
    system: Optional[str] = None,
) -> str:
    """Unified LLM caller. Add new providers here."""

    if provider.provider == "ollama":
        return await _call_ollama(provider, messages, system)
    elif provider.provider == "openai":
        return await _call_openai(provider, messages, system)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider.provider}")


async def _call_ollama(provider: ProviderConfig, messages: list, system: Optional[str]) -> str:
    payload = {
        "model": provider.model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": provider.temperature or 0.8},
    }
    if system:
        payload["system"] = system

    base = (provider.base_url or "http://localhost:11434").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(f"{base}/api/chat", json=payload)
            r.raise_for_status()
            return r.json()["message"]["content"]
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail=f"Cannot reach Ollama at {base}. Is it running?")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Ollama error: {e.response.text}")


async def _call_openai(provider: ProviderConfig, messages: list, system: Optional[str]) -> str:
    api_key = provider.api_key or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="No OpenAI API key provided")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    full_messages = []
    if system:
        full_messages.append({"role": "system", "content": system})
    full_messages.extend(messages)

    payload = {
        "model": provider.model,
        "messages": full_messages,
        "temperature": provider.temperature or 0.8,
        "max_tokens": provider.max_tokens or 2048,
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers, json=payload
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {e.response.text}")


async def list_ollama_models(base_url: str) -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{base_url.rstrip('/')}/api/tags")
            r.raise_for_status()
            return [m["name"] for m in r.json().get("models", [])]
    except Exception:
        return []
