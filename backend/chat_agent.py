# ============================================================
# The brain: a LangGraph ReAct agent with a few read-only history tools.
# Structure ported from the qubits-dealflow assistant's graph.py: a small set
# of tools, one system prompt, and a model-fallback loop that moves to the
# next candidate model on a capacity error rather than failing the request.
# ============================================================

from __future__ import annotations

import logging
from dataclasses import dataclass

from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from openai import APIStatusError, RateLimitError

import history_tools
from prompt import system_prompt

log = logging.getLogger("amc-backend.chat")

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
CANDIDATE_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]


def _is_capacity_error(failure: Exception) -> bool:
    if isinstance(failure, RateLimitError):
        return True
    if isinstance(failure, APIStatusError):
        return failure.status_code in (429, 500, 502, 503, 504)
    return False


def _llm(model: str, api_key: str) -> ChatOpenAI:
    return ChatOpenAI(model=model, temperature=0, api_key=api_key, base_url=GROQ_BASE_URL, max_retries=2, timeout=30)


def _tools_for(user_id: int | None) -> list:
    """History tools bound to the asking user — user_id always comes from the
    server's session lookup, never from the model, so it isn't an argument
    the LLM can supply or override."""
    if user_id is None:
        return []

    @tool
    def list_recent_analyses(limit: int = 10) -> str:
        """List the user's most recent signal analyses, most recent first."""
        return str(history_tools.list_recent(user_id, limit))

    @tool
    def search_analyses(
        modulation: str | None = None, min_confidence: float | None = None,
        min_snr: float | None = None, limit: int = 20,
    ) -> str:
        """Search the user's past analyses by modulation type and/or minimum
        confidence (0-100) and/or minimum SNR (dB)."""
        return str(history_tools.search(user_id, modulation, min_confidence, min_snr, limit))

    @tool
    def analysis_stats() -> str:
        """Aggregate stats over the user's history: total run count, average
        confidence, first/last run time, and a breakdown by modulation type."""
        return str(history_tools.stats(user_id))

    return [list_recent_analyses, search_analyses, analysis_stats]


class AllModelsBusy(RuntimeError):
    """Every configured model refused for capacity reasons."""


@dataclass(frozen=True)
class Reply:
    answer: str
    model: str


async def answer(messages: list[dict], live_context: dict | None, user_id: int | None, api_key: str) -> Reply:
    """Ask the question, moving to the next model on a capacity failure."""
    agent_messages = [{"role": "system", "content": system_prompt(live_context)}, *messages]
    tools = _tools_for(user_id)

    last: Exception | None = None
    for model in CANDIDATE_MODELS:
        agent = create_react_agent(_llm(model, api_key), tools)
        try:
            result = await agent.ainvoke({"messages": agent_messages})
        except Exception as failure:
            if not _is_capacity_error(failure):
                raise
            log.warning("%s is out of capacity (%s); trying the next model", model, failure)
            last = failure
            continue
        return Reply(answer=result["messages"][-1].content, model=model)

    raise AllModelsBusy(str(last) if last else "no models configured")
