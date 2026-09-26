# ============================================================
# Read-only lookups over a user's own analysis history, for the chat
# assistant. Unlike the qubits-dealflow assistant this is modeled on, the
# model here never writes raw SQL: with a single small table there's no
# reason to accept that injection surface, so every query is parameterized
# and `user_id` is always supplied by the server from the authenticated
# session, never by the model. See chat_agent.py for how these are bound to
# the current user and exposed to the LLM as tools.
# ============================================================

from __future__ import annotations

from typing import Any

from db import pool

MAX_ROWS = 50


def list_recent(user_id: int, limit: int = 10) -> list[dict[str, Any]]:
    limit = max(1, min(limit, MAX_ROWS))
    with pool().connection() as conn:
        rows = conn.execute(
            """SELECT id, file_name, modulation, confidence, summary, created_at
               FROM analyses WHERE user_id = %s ORDER BY created_at DESC LIMIT %s""",
            (user_id, limit),
        ).fetchall()
    return [_render(r) for r in rows]


def search(
    user_id: int,
    modulation: str | None = None,
    min_confidence: float | None = None,
    min_snr: float | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    limit = max(1, min(limit, MAX_ROWS))
    clauses = ["user_id = %s"]
    params: list[Any] = [user_id]
    if modulation:
        clauses.append("modulation ILIKE %s")
        params.append(modulation)
    if min_confidence is not None:
        clauses.append("confidence >= %s")
        params.append(min_confidence)
    if min_snr is not None:
        clauses.append("(summary->>'snr')::float >= %s")
        params.append(min_snr)
    params.append(limit)

    with pool().connection() as conn:
        rows = conn.execute(
            f"""SELECT id, file_name, modulation, confidence, summary, created_at
                FROM analyses WHERE {' AND '.join(clauses)}
                ORDER BY created_at DESC LIMIT %s""",
            params,
        ).fetchall()
    return [_render(r) for r in rows]


def stats(user_id: int) -> dict[str, Any]:
    with pool().connection() as conn:
        totals = conn.execute(
            """SELECT COUNT(*) AS total, AVG(confidence) AS avg_confidence,
                      MIN(created_at) AS first_run, MAX(created_at) AS last_run
               FROM analyses WHERE user_id = %s""",
            (user_id,),
        ).fetchone()
        by_modulation = conn.execute(
            """SELECT modulation, COUNT(*) AS count, AVG(confidence) AS avg_confidence
               FROM analyses WHERE user_id = %s
               GROUP BY modulation ORDER BY count DESC""",
            (user_id,),
        ).fetchall()
    return {**_render(totals), "byModulation": [_render(r) for r in by_modulation]}


def _render(row: dict) -> dict:
    return {k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in row.items()}
