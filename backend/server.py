"""FastAPI SSE server — bridges the LangGraph agent with the Next.js frontend.

Events streamed to the frontend:
  data: {"type": "thought", "content": "..."}   — agent reasoning / tool calls
  data: {"type": "answer",  "content": "..."}   — final answer tokens
  data: {"type": "done"}                         — stream complete
  data: {"type": "error",  "content": "..."}    — error
"""

from __future__ import annotations

import json
import logging
import os
from typing import AsyncGenerator

from dotenv import load_dotenv

# Load .env BEFORE anything else so that graph.py sees DEEPSEEK_API_KEY etc.
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from contextlib import asynccontextmanager
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from graph import build_workflow, _DEEPSEEK_MODELS, _create_llm

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("server")

# ---------------------------------------------------------------------------
# App & Lifespan
# ---------------------------------------------------------------------------
COMPILED_GRAPH = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global COMPILED_GRAPH
    async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
        await checkpointer.setup()
        workflow = build_workflow()
        COMPILED_GRAPH = workflow.compile(checkpointer=checkpointer)
        yield

app = FastAPI(title="HUST Q&A Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sse(etype: str, content: str = "") -> str:
    """Format a single SSE data line."""
    return "data: " + json.dumps({"type": etype, "content": content}, ensure_ascii=False) + "\n\n"








# ---------------------------------------------------------------------------
# Agent streaming via LangGraph astream_events
# ---------------------------------------------------------------------------

async def _stream_agent(
    question: str,
    model_name: str,
    thread_id: str,
    user_id: str,
) -> AsyncGenerator[str, None]:
    """Run the LangGraph ReAct agent and convert events to SSE.

    Streaming logic:
      - LLM tokens are buffered until we know if they lead to tool calls ("thought")
        or final answer ("answer").
      - on_chat_model_end with tool_calls → flush buffer as "thought".
      - on_chat_model_end without tool_calls → flush buffer as "answer" (final).
    """

    config = {
        "configurable": {
            "model_name": model_name,
            "thread_id": thread_id,
            "user_id": user_id,
        }
    }
    thought_buffer = ""
    seen_answer = False
    agent_step = 0
    tool_calls_seen = False  # becomes True after first tool_calls complete

    try:
        async for event in COMPILED_GRAPH.astream_events({"messages": [HumanMessage(content=question)]}, config, version="v2"):
            kind = event.get("event", "")

            # ── Agent node starts ──────────────────────────────────────────
            if kind == "on_chain_start" and event.get("name") == "agent":
                agent_step += 1
                if agent_step == 1:
                    yield _sse("thought",
                               f"\U0001F914 Đang phân tích câu hỏi: \"{question[:120]}\"")
                else:
                    yield _sse("thought",
                               "\U0001F4CB Đang tổng hợp câu trả lời...")

            # ── LLM streaming tokens ───────────────────────────────────────
            elif kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                token: str = getattr(chunk, "content", "") or ""
                if token:
                    if tool_calls_seen:
                        # After tool calls: stream final answer token-by-token
                        yield _sse("answer", token)
                        seen_answer = True
                    else:
                        thought_buffer += token

            # ── LLM finished generating ────────────────────────────────────
            elif kind == "on_chat_model_end":
                output = event.get("data", {}).get("output", {})
                tool_calls = getattr(output, "tool_calls", None) or []
                if tool_calls:
                    if thought_buffer:
                        yield _sse("thought", thought_buffer.strip())
                else:
                    if thought_buffer:
                        yield _sse("answer", thought_buffer)
                        seen_answer = True
                thought_buffer = ""

            # ── Tool calls ─────────────────────────────────────────────────
            elif kind == "on_tool_start":
                if thought_buffer:
                    yield _sse("thought", thought_buffer.strip())
                    thought_buffer = ""
                tool_input = event.get("data", {}).get("input", {})
                query = tool_input.get("query", "")
                yield _sse("thought", f"\U0001F50D Đang tra cứu: \"{query}\"")

            elif kind == "on_tool_end":
                tool_calls_seen = True
                output = event.get("data", {}).get("output", "")
                preview = str(output)[:250].replace("\n", " ").strip()
                if preview:
                    yield _sse("thought", f"\U0001F4CA Kết quả: {preview}")

    except Exception as exc:
        logger.exception("Agent streaming error for question: %s", question[:80])
        yield _sse("error", f"Lỗi xử lý: {str(exc)[:300]}")

    if not seen_answer:
        yield _sse("error", "Không có câu trả lời nào được sinh ra.")

    yield _sse("done")


# ---------------------------------------------------------------------------
# Main streaming dispatcher
# ---------------------------------------------------------------------------

async def _dispatch(
    question: str,
    model_name: str,
    thread_id: str,
    user_id: str,
) -> AsyncGenerator[str, None]:
    """Choose fast-path or agent path, then stream."""

    logger.info("Agent [model=%s, thread=%s, user=%s]: %s", model_name, thread_id, user_id, question[:80])

    async for event in _stream_agent(question, model_name, thread_id, user_id):
        yield event


# ---------------------------------------------------------------------------
# /ask endpoint
# ---------------------------------------------------------------------------

@app.post("/ask")
async def ask(request: Request) -> StreamingResponse:
    """Accept a question and stream thoughts + answer via SSE."""
    body = await request.json()
    question: str = body.get("question", "").strip()
    model_name: str = body.get("model", "deepseek").strip().lower()
    
    # Optional IDs cho quản lý bộ nhớ
    thread_id: str = body.get("thread_id", "default_thread")
    user_id: str = body.get("user_id", "default_user")

    if not question:
        async def _err():
            yield _sse("error", "Empty question")
        return StreamingResponse(_err(), media_type="text/event-stream")

    return StreamingResponse(
        _dispatch(question, model_name, thread_id, user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection":    "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# /health endpoint
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting HUST Q&A Backend on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")