from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime
import db

router = APIRouter(prefix="/sessions", tags=["sessions"])


class SessionCreate(BaseModel):
    name: str
    description: Optional[str] = ""


@router.post("", status_code=201)
async def create_session(body: SessionCreate):
    session_id = str(uuid.uuid4())
    return db.create_session(session_id, body.name, body.description or "")


@router.get("")
async def list_sessions():
    return db.list_sessions()


@router.get("/{session_id}")
async def get_session(session_id: str):
    s = db.get_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


@router.delete("/{session_id}", status_code=204)
async def delete_session(session_id: str):
    s = db.get_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete_session(session_id)


@router.get("/{session_id}/attacks")
async def list_session_attacks(session_id: str, limit: int = 100):
    s = db.get_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return db.list_attacks(session_id, limit)


@router.get("/{session_id}/metrics")
async def session_metrics(session_id: str):
    s = db.get_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return db.get_metrics(session_id)
