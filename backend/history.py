from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from auth import _bad, _token_hash, current_user
from db import pool

router = APIRouter(prefix="/api/v1/history", tags=["history"])


def _require_token_hash(authorization: str | None) -> bytes:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _bad("Not signed in.", status=401)
    return _token_hash(authorization[7:].strip())


class SaveAnalysisIn(BaseModel):
    fileName: str
    modulation: str
    confidence: float
    summary: dict[str, Any]
    data: dict[str, Any]


@router.post("")
def save_analysis(body: SaveAnalysisIn, user: dict = Depends(current_user)):
    with pool().connection() as conn:
        row = conn.execute(
            """INSERT INTO analyses (user_id, file_name, modulation, confidence, summary, data)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, created_at""",
            (user["id"], body.fileName, body.modulation, body.confidence,
             Jsonb(body.summary), Jsonb(body.data)),
        ).fetchone()
    return {"id": row["id"], "createdAt": int(row["created_at"].timestamp() * 1000)}


@router.get("")
def list_analyses(authorization: str | None = Header(default=None)):
    # Deliberately excludes `data` (parameters, full preview arrays, ...) -- that column can run to
    # tens of KB per row with IQ/spectrum/waterfall points, and the table only needs `summary`
    # (a couple hundred bytes) to render, so leaving it out keeps this list query fast regardless
    # of history size.
    #
    # Session check + row fetch are folded into one query (joined straight off `sessions`,
    # skipping `current_user`'s own round trip) because this endpoint backs the history page's
    # main load and every round trip to a serverless Postgres instance costs real, visible time.
    # LEFT JOIN (not JOIN): a valid session with zero analyses must still come back as one row
    # (id NULL) so "no history yet" and "bad/expired session" are told apart without a second
    # query -- a brand-new user with an empty history is the common case, not the exceptional one.
    token_hash = _require_token_hash(authorization)
    with pool().connection() as conn:
        rows = conn.execute(
            """SELECT a.id, a.file_name, a.modulation, a.confidence, a.summary, a.created_at
               FROM sessions s LEFT JOIN analyses a ON a.user_id = s.user_id
               WHERE s.token_hash = %s AND s.expires_at > now()
               ORDER BY a.created_at DESC NULLS LAST LIMIT 200""",
            (token_hash,),
        ).fetchall()
    if not rows:
        raise _bad("Session expired.", status=401)
    rows = [r for r in rows if r["id"] is not None]
    return [
        {
            "id": r["id"], "fileName": r["file_name"], "modulation": r["modulation"],
            "confidence": r["confidence"], "createdAt": int(r["created_at"].timestamp() * 1000),
            **r["summary"],
        }
        for r in rows
    ]


@router.get("/{analysis_id}")
def get_analysis(analysis_id: int, user: dict = Depends(current_user)):
    with pool().connection() as conn:
        row = conn.execute(
            "SELECT id, file_name, modulation, confidence, data, created_at FROM analyses WHERE id = %s AND user_id = %s",
            (analysis_id, user["id"]),
        ).fetchone()
    if not row:
        raise HTTPException(404, "Analysis not found.")
    return {
        "id": row["id"], "fileName": row["file_name"], "modulation": row["modulation"],
        "confidence": row["confidence"], "createdAt": int(row["created_at"].timestamp() * 1000),
        "data": row["data"],
    }


@router.delete("/{analysis_id}")
def delete_analysis(analysis_id: int, user: dict = Depends(current_user)):
    with pool().connection() as conn:
        result = conn.execute(
            "DELETE FROM analyses WHERE id = %s AND user_id = %s", (analysis_id, user["id"]),
        )
    if result.rowcount == 0:
        raise HTTPException(404, "Analysis not found.")
    return {"ok": True}
