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
    _pool = ConnectionPool(url, min_size=1, max_size=5, kwargs={"row_factory": dict_row}, open=True)
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
