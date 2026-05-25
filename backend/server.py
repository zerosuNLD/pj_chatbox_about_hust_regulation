"""FastAPI SSE server — bridges the LangGraph agent with the Next.js frontend.
ngrok http 8000 --region ap

SSE events streamed to the frontend:
  data: {"type": "thought",        "content": "..."}  — agent reasoning / tool calls
  data: {"type": "answer",         "content": "..."}  — final answer text (streaming)
  data: {"type": "answer_retract", "content": "..."}  — retract streamed answer (was thought)
  data: {"type": "sources",        "content": [...]}  — list of source references
  data: {"type": "clarify",        "content": "..."}  — HITL: agent needs confirmation
  data: {"type": "done"}                               — stream complete
  data: {"type": "error",          "content": "..."}  — error
"""

from __future__ import annotations

import json
import logging
import os
import platform
from typing import AsyncGenerator

from dotenv import load_dotenv

# Load .env BEFORE anything else so that standard_graph.py sees DEEPSEEK_API_KEY etc.
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from contextlib import asynccontextmanager
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from standard_graph import build_workflow, _DEFAULT_MODEL

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

# Avoid SQLite disk I/O errors on WSL by using native Linux temp dir
DB_PATH = "checkpoints.db"
if platform.system() == "Linux" and "microsoft" in platform.release().lower():
    DB_PATH = "/tmp/hust_qa_checkpoints.db"
    logger.info("WSL detected: using %s for checkpoints to avoid disk I/O error", DB_PATH)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global COMPILED_GRAPH
    async with AsyncSqliteSaver.from_conn_string(DB_PATH) as checkpointer:
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

def _sse(etype: str, content=None) -> str:
    """Format a single SSE data line."""
    if content is None:
        content = ""
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
    """Run the Agent and convert events to SSE."""
    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": user_id,
            "model_name": model_name,
        }
    }
    seen_answer = False
    agent_step = 0
    current_turn_streamed = ""    # optimistic answer tokens in current turn (retractable)

    try:
        import asyncio
        async with asyncio.timeout(90.0):
            async for event in COMPILED_GRAPH.astream_events(
                {"messages": [HumanMessage(content=question)]}, config, version="v2"
            ):
                kind = event.get("event", "")
                name = event.get("name", "")

                # ── Agent node starts (new LLM turn) ──────────────────────────
                if kind == "on_chain_start" and name == "agent":
                    agent_step += 1
                    current_turn_streamed = ""   # reset per-turn tracking
                    if agent_step == 1:
                        yield _sse("thought", f"\U0001F914 Đang phân tích câu hỏi: \"{question[:120]}\"")

                # ── LLM token streaming ────────────────────────────────────────
                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    token: str = getattr(chunk, "content", "") or ""
                    if not token:
                        continue

                    # Optimistically stream as answer (may be retracted below)
                    yield _sse("answer", token)
                    current_turn_streamed += token
                    seen_answer = True

                # ── LLM turn ended: confirm answer or retract ──────────────────
                elif kind == "on_chat_model_end":
                    output = event.get("data", {}).get("output", {})
                    tool_calls = getattr(output, "tool_calls", None) or []

                    if tool_calls:
                        if current_turn_streamed:
                            # ❌ We streamed intermediate thought as answer — retract it
                            yield _sse("answer_retract", current_turn_streamed.strip())
                            yield _sse("thought", current_turn_streamed.strip())
                            seen_answer = False
                            current_turn_streamed = ""
                    else:
                        # ✅ No tool calls — this IS the final answer
                        # Tokens already streamed correctly ✓
                        current_turn_streamed = ""

                # ── Tool call starts ───────────────────────────────────────────
                elif kind == "on_tool_start":
                    tool_input = event.get("data", {}).get("input", {})
                    query = tool_input.get("query", tool_input.get("fact", ""))
                    tool_nm = event.get("name", "")
                    if tool_nm == "save_user_memory":
                        yield _sse("thought", "\U0001F4BE Đang kiểm tra xác nhận lưu thông tin...")
                    else:
                        yield _sse("thought", f"\U0001F50D Đang tra cứu: \"{query}\"")

                # ── Tool call ends ─────────────────────────────────────────────
                elif kind == "on_tool_end":
                    output = event.get("data", {}).get("output", "")
                    preview = str(output)[:250].replace("\n", " ").strip()
                    if preview:
                        yield _sse("thought", f"\U0001F4CA Kết quả: {preview}")

    except Exception as exc:
        if "TimeoutError" in type(exc).__name__:
            logger.warning("Agent hit 90s timeout for question: %s", question[:80])
            yield _sse("thought", "⏳ Đã hết thời gian tra cứu, đang tổng hợp các thông tin đã tìm được...")
            try:
                state = await COMPILED_GRAPH.aget_state(config)
                messages = state.values.get("messages", [])

                if messages:
                    from standard_graph import _create_llm
                    llm = _create_llm(model_name if model_name else _DEFAULT_MODEL)

                    fallback_msg = HumanMessage(content="[HỆ THỐNG]: Đã hết thời gian xử lý. Dựa vào các thông tin bạn đã gọi tool và thu thập được ở trên, hãy đưa ra câu trả lời cuối cùng ngay lập tức. Nếu không có thông tin, hãy nói rõ là chưa tìm thấy. Trả lời bằng tiếng Việt, ngắn gọn.")
                    resp = await llm.ainvoke(messages + [fallback_msg])
                    yield _sse("answer", resp.content)
                    seen_answer = True
                else:
                    yield _sse("error", "Lỗi: Đã hết thời gian (90 giây) nhưng chưa có câu trả lời.")
            except Exception as fallback_exc:
                logger.exception("Fallback timeout synthesis failed")
                yield _sse("error", "Lỗi: Đã hết thời gian (90 giây) và không thể tổng hợp câu trả lời.")
        elif "GraphRecursionError" in type(exc).__name__:
            logger.warning("Agent hit recursion limit for question: %s", question[:80])
            yield _sse("error", "Lỗi: Đã quá số bước suy luận.")
        else:
            logger.exception("Agent streaming error for question: %s", question[:80])
            yield _sse("error", f"Loi xu ly: {str(exc)[:300]}")

    if not seen_answer:
        yield _sse("error", "Khong co cau tra loi nao duoc sinh ra.")

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
    """Stream the agent response."""

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
    model_name: str = body.get("model", _DEFAULT_MODEL).strip().lower()

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
# /resume endpoint — continue after HITL interrupt
# ---------------------------------------------------------------------------

@app.post("/resume")
async def resume(request: Request) -> StreamingResponse:
    """Resume a paused agent after human-in-the-loop confirmation.

    Body: {"thread_id": str, "approved": bool, "user_id": str}
    - approved=true  -> agent continues executing the interrupted tool call
    - approved=false -> agent receives a rejection and stops the tool call
    """
    body = await request.json()
    thread_id: str = body.get("thread_id", "default_thread")
    user_id: str = body.get("user_id", "default_user")
    approved: bool = body.get("approved", False)

    async def _resume_stream() -> AsyncGenerator[str, None]:
        config = {"configurable": {"thread_id": thread_id, "user_id": user_id}}
        resume_value = None if approved else "User rejected this action."
        seen_answer = False
        try:
            async for event in COMPILED_GRAPH.astream_events(
                {"__resume__": resume_value}, config, version="v2"
            ):
                kind = event.get("event", "")
                if kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    token: str = getattr(chunk, "content", "") or ""
                    if token:
                        yield _sse("answer", token)
                        seen_answer = True
                elif kind == "on_chat_model_end":
                    output = event.get("data", {}).get("output", {})
                    content_val = getattr(output, "content", "")
                    if isinstance(content_val, str) and content_val.strip():
                        if not seen_answer:
                            yield _sse("answer", content_val)
                            seen_answer = True
        except Exception as exc:
            logger.exception("Resume error thread=%s", thread_id)
            yield _sse("error", f"Loi tiep tuc: {str(exc)[:300]}")
        if not seen_answer:
            msg = "Da tiep tuc xu ly." if approved else "Da huy hanh dong."
            yield _sse("answer", msg)
        yield _sse("done")

    return StreamingResponse(
        _resume_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting HUST Q&A Backend on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")