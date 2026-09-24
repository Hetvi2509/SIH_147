from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from psycopg.errors import UniqueViolation
from pydantic import BaseModel

from db import pool

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

SESSION_DAYS = 30
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


class SignUpIn(BaseModel):
    name: str
    email: str
    password: str


class SignInIn(BaseModel):
    email: str
    password: str


def _hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)


def _token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def _public(row: dict) -> dict:
    return {"name": row["name"], "email": row["email"], "createdAt": int(row["created_at"].timestamp() * 1000)}


def _bad(message: str, field: str | None = None, status: int = 400) -> HTTPException:
    return HTTPException(status_code=status, detail={"message": message, "field": field})


def _new_session(conn, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
        (_token_hash(token), user_id, expires),
    )
    return token


def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _bad("Not signed in.", status=401)
    token = authorization[7:].strip()
    with pool().connection() as conn:
        row = conn.execute(
            """SELECT u.id, u.name, u.email, u.created_at
               FROM sessions s JOIN users u ON u.id = s.user_id
               WHERE s.token_hash = %s AND s.expires_at > now()""",
            (_token_hash(token),),
        ).fetchone()
    if not row:
        raise _bad("Session expired.", status=401)
    return row


@router.post("/signup")
def signup(body: SignUpIn):
    name = re.sub(r"\s+", " ", body.name.strip())
    email = body.email.strip().lower()
    if len(name) < 2:
        raise _bad("Enter your full name.", "name")
    if not EMAIL_RE.match(email):
        raise _bad("Enter a valid email address.", "email")
    if len(body.password) < 8:
        raise _bad("Use at least 8 characters.", "password")

    salt = secrets.token_bytes(16)
    pw_hash = _hash_password(body.password, salt)
    try:
        with pool().connection() as conn:
            row = conn.execute(
                """INSERT INTO users (name, email, password_salt, password_hash)
                   VALUES (%s, %s, %s, %s) RETURNING id, name, email, created_at""",
                (name, email, salt, pw_hash),
            ).fetchone()
            token = _new_session(conn, row["id"])
    except UniqueViolation:
        raise _bad("An account with this email already exists.", "email", 409)
    return {"user": _public(row), "token": token}


@router.post("/login")
def login(body: SignInIn):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise _bad("Enter a valid email address.", "email")
    if not body.password:
        raise _bad("Enter your password.", "password")

    with pool().connection() as conn:
        row = conn.execute(
            "SELECT id, name, email, created_at, password_salt, password_hash FROM users WHERE email = %s",
            (email,),
        ).fetchone()
        # Same message for unknown email and wrong password, so emails are not enumerable.
        candidate = _hash_password(body.password, bytes(row["password_salt"]) if row else b"\0" * 16)
        if not row or not hmac.compare_digest(candidate, bytes(row["password_hash"])):
            raise _bad("Email or password is incorrect.", "password", 401)
        token = _new_session(conn, row["id"])
    return {"user": _public(row), "token": token}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return {"user": _public(user)}


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        with pool().connection() as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = %s", (_token_hash(authorization[7:].strip()),))
    return {"ok": True}
