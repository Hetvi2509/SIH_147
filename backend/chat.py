# ============================================================
# Conversational assistant endpoint — a LangGraph ReAct agent (chat_agent.py)
# that answers questions about the current analysis run from the snapshot the
# frontend sends, and about the user's analysis history via history_tools.py.
# ============================================================

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import current_user_optional
from chat_agent import AllModelsBusy, answer

load_dotenv(Path(__file__).parent / ".env")

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: dict[str, Any] = {}


class ChatResponse(BaseModel):
    reply: str
    model: str


@router.post("/query", response_model=ChatResponse)
async def chat_query(body: ChatRequest, user: dict | None = Depends(current_user_optional)) -> ChatResponse:
    if not body.messages:
        raise HTTPException(400, "messages must not be empty.")

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(503, "GROQ_API_KEY is not set (backend/.env).")

    try:
        reply = await answer(
            messages=[{"role": m.role, "content": m.content} for m in body.messages],
            live_context=body.context or None,
            user_id=user["id"] if user else None,
            api_key=api_key,
        )
    except AllModelsBusy:
        raise HTTPException(503, "The assistant is busy right now. Please try again in a moment.")
    except Exception as exc:
        raise HTTPException(502, f"Assistant request failed: {exc}")

    return ChatResponse(reply=reply.answer or "I couldn't generate a response for that.", model=reply.model)
