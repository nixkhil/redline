import os
import time
import uuid
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from loguru import logger

import db
from config import get_settings
from attacks import ATTACK_CATEGORIES
from llm import list_ollama_models, ProviderConfig
from routers import sessions, attack_routes

# ── Logging ───────────────────────────────────────────────────────────────────

logger.add("logs/redline.log", rotation="10 MB", retention="30 days",
           format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}", level="INFO")

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("logs", exist_ok=True)
    db.init_db()
    logger.info("Redline started — DB initialized")
    yield
    logger.info("Redline shutting down")

# ── App ───────────────────────────────────────────────────────────────────────

settings = get_settings()

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.rate_limit_per_minute}/minute"])

app = FastAPI(
    title="Redline — LLM Pressure Testing API",
    version="2.0.0",
    description="Production-grade LLM red-teaming framework",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request logging middleware ────────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = round((time.time() - start) * 1000)
    logger.info(f"{request.method} {request.url.path} → {response.status_code} [{elapsed}ms]")
    return response

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(sessions.router)
app.include_router(attack_routes.router)

# ── Core endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "operational",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/attack-categories")
async def get_attack_categories():
    return ATTACK_CATEGORIES


@app.get("/metrics")
async def global_metrics():
    """Global metrics across all sessions."""
    return db.get_metrics()


@app.get("/models/ollama")
async def get_ollama_models(base_url: str = "http://localhost:11434"):
    models = await list_ollama_models(base_url)
    if not models:
        raise HTTPException(status_code=503, detail=f"Cannot reach Ollama at {base_url}")
    return {"models": models}
