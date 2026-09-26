from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv(Path(__file__).parent / ".env")

_pool: ConnectionPool | None = None


def init_pool() -> None:
    global _pool
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set (backend/.env)")
    _pool = ConnectionPool(
        url, min_size=1, max_size=5, kwargs={"row_factory": dict_row}, open=True,
        # Neon auto-suspends idle computes (~5 min) and drops the TCP connection server-side.
        # `check=ConnectionPool.check_connection` would catch that, but it runs an extra round
        # trip on every single checkout -- at Neon's cross-region latency (hundreds of ms here)
        # that doubles the cost of every request in the app. Recycling idle connections in the
        # background well before Neon's suspend threshold self-heals the same problem for free.
        max_idle=120,
    )
    schema = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
    with _pool.connection() as conn:
        conn.execute(schema)


def close_pool() -> None:
    if _pool is not None:
        _pool.close()


def pool() -> ConnectionPool:
    if _pool is None:
        raise RuntimeError("DB pool not initialised")
    return _pool
