"""LangGraph agent for HUST training regulation Q&A.

Builds a tool-calling agent that searches the knowledge graph
and returns answers via `.astream_events()`.
"""

from __future__ import annotations

import os
from typing import Literal

from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import StructuredTool, tool
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langgraph.graph import END, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
import sqlite3
import uuid

# Mở kết nối SQLite cho bộ nhớ dài hạn (Long-term memory)
store_conn = sqlite3.connect("long_term_memory.db", check_same_thread=False)
store_conn.execute('''CREATE TABLE IF NOT EXISTS user_memories
                      (user_id TEXT, key TEXT PRIMARY KEY, fact TEXT)''')
store_conn.commit()

from graphrag_tools import global_search_hybrid, local_search_hybrid, warmup

_GROQ_KEY: str | None = os.environ.get("GROQ_API_KEY")
_DEEPSEEK_KEY: str | None = os.environ.get("DEEPSEEK_API_KEY")



def _local_search(query: str, top_k: int = 10) -> str:
    """Search knowledge-graph entities/relationships for specific facts,
    requirements, deadlines, scores, or particular regulations.
    Returns detailed entity descriptions and relationships with raw passages."""
    return local_search_hybrid(query, top_k)


def _global_search(query: str, top_k: int = 10) -> str:
    """Search community summaries for broad themes, policies, or overviews
    across multiple regulation topics.
    Returns structured report summaries with key findings."""
    return global_search_hybrid(query, top_k)


LOCAL_SEARCH_TOOL = StructuredTool.from_function(
    func=_local_search,
    name="local_search_hybrid",
    description=(
        "Search the HUST knowledge graph for specific entities, facts, requirements, "
        "deadlines, scores, or particular regulations. "
        "Returns entity descriptions, relationships, and relevant raw passages. "
        "Best for: specific factual questions."
    ),
)

GLOBAL_SEARCH_TOOL = StructuredTool.from_function(
    func=_global_search,
    name="global_search_hybrid",
    description=(
        "Search HUST community summaries for broad topics, overviews, policies, "
        "or thematic summaries across multiple regulation categories. "
        "Returns structured report summaries. "
        "Best for: broad thematic questions."
    ),
)

@tool
def save_user_memory(
    fact: str,
    config: RunnableConfig,
) -> str:
    """Lưu lại một thông tin, sở thích, hoặc sự kiện quan trọng về người dùng vào bộ nhớ dài hạn.
    Sử dụng công cụ này khi người dùng cung cấp thông tin cá nhân hoặc yêu cầu bạn ghi nhớ điều gì đó.
    
    Args:
        fact: Thông tin cần ghi nhớ về người dùng.
    """
    user_id = config.get("configurable", {}).get("user_id")
    if not user_id:
        return "Lỗi: Không tìm thấy user_id."
    
    key = str(uuid.uuid4())
    store_conn.execute("INSERT INTO user_memories (user_id, key, fact) VALUES (?, ?, ?)",
                       (user_id, key, fact))
    store_conn.commit()
    return f"Đã lưu: {fact}"

_AGENT_TOOLS = [LOCAL_SEARCH_TOOL, GLOBAL_SEARCH_TOOL, save_user_memory]


# ---------------------------------------------------------------------------
# LLM factory
# ---------------------------------------------------------------------------

# Maps user-facing model aliases → (provider, actual_model_id)
_GROQ_MODELS: dict[str, str] = {
    "groq": "llama-3.3-70b-versatile",
}

_OLLAMA_MODELS: dict[str, str] = {
    "llama-3.1-8b": "llama3.1:latest",   # local model via Ollama
}

_DEEPSEEK_MODELS: dict[str, str] = {
    "deepseek": "deepseek-chat",
}

_DEFAULT_MODEL = "deepseek"

# LLM instance cache — avoid rebuilding the HTTP client on every agent call
_llm_cache: dict[str, object] = {}


def _create_llm(model_name: str):
    """Return a (cached) LangChain chat model for *model_name*."""
    name = model_name.strip().lower()

    if name in _llm_cache:
        return _llm_cache[name]

    if name in _GROQ_MODELS:
        if not _GROQ_KEY:
            raise ValueError("GROQ_API_KEY is not set in the environment.")
        llm = ChatGroq(
            model=_GROQ_MODELS[name],
            api_key=_GROQ_KEY,
            temperature=0.1,
        )

    elif name in _OLLAMA_MODELS:
        llm = ChatOpenAI(
            model=_OLLAMA_MODELS[name],
            base_url="http://localhost:11434/v1",
            api_key="ollama",
            temperature=0.1,
        )

    elif name in _DEEPSEEK_MODELS:
        if not _DEEPSEEK_KEY:
            raise ValueError("DEEPSEEK_API_KEY is not set in the environment.")
        llm = ChatOpenAI(
            model=_DEEPSEEK_MODELS[name],
            api_key=_DEEPSEEK_KEY,
            base_url="https://api.deepseek.com/v1",
            temperature=0.1,
        )

    else:
        import logging
        logging.getLogger(__name__).warning(
            "Unknown model alias %r — falling back to %r", model_name, _DEFAULT_MODEL
        )
        return _create_llm(_DEFAULT_MODEL)

    _llm_cache[name] = llm
    return llm


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_BASE_RULES = """
## Nguyên tắc sử dụng công cụ

- Dùng `local_search_hybrid` cho các câu hỏi cụ thể như:
  điều kiện, mức điểm, thời hạn, quy trình, học phần,
  chương trình đào tạo.

- Dùng `global_search_hybrid` cho các câu hỏi tổng quan,
  so sánh nhiều quy định hoặc khi kết quả local chưa đủ.

- Có thể dùng cả hai công cụ nếu cần.

- **TUYỆT ĐỐI KHÔNG dùng bất kỳ công cụ nào** cho các câu chào hỏi, cảm ơn,
  hỏi thăm sức khỏe, hoặc hội thoại thông thường không liên quan đến quy chế
  (ví dụ: "xin chào", "bạn là ai", "cảm ơn", "hôm nay thế nào"...).
  Với những câu này, trả lời trực tiếp ngay lập tức, KHÔNG gọi tool.

## Nguyên tắc trả lời

1. Trả lời ngắn gọn, đi thẳng vào ý chính.

2. Chỉ sử dụng thông tin tìm được từ tài liệu.
   Không tự suy đoán hoặc bổ sung ngoài nguồn.

3. Nếu không đủ thông tin, trả lời:
   "Xin lỗi, tôi chưa tìm thấy thông tin chính xác trong tài liệu hiện có."

4. Nếu câu hỏi ngoài phạm vi tài liệu HUST, trả lời:
   "Câu hỏi này nằm ngoài phạm vi tài liệu tôi được cung cấp."

5. Chỉ ghi nguồn khi thực hiện tra cứu thông tin từ quy chế đào tạo HUST .Tuyệt đối KHÔNG ghi nguồn (ví dụ: "[Nguồn: Bộ nhớ dài hạn]", "[Nguồn: Bộ nhớ ngắn hạn]", "[Nguồn: Tự sự/Thông tin cá nhân]", v.v.) khi trả lời các câu hỏi chào hỏi, tự sự, hoặc khi sử dụng thông tin từ bộ nhớ dài hạn/ngắn hạn của người dùng.
   Khi có nguồn, PHẢI đặt xuống dòng mới bên dưới nội dung, theo đúng định dạng:

   <nội dung trả lời>

   ---
   **Nguồn:** <tên tài liệu hoặc mục, chương trong quy chế>


6. Luôn trả lời bằng tiếng Việt lịch sự, lễ phép, tôn trọng người dùng (xưng hô phù hợp, sử dụng các từ ngữ lịch thiệp), ngắn gọn và chuyên nghiệp.

"""
_SYSTEM_PROMPT = (
    "Bạn là trợ lý chuyên về quy chế đào tạo Đại học Bách Khoa Hà Nội (HUST).\n"
    + _BASE_RULES
)


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

async def _call_model(state: MessagesState, config: RunnableConfig) -> dict:
    """Agent node: invoke the LLM with tools bound."""
    cfg = config.get("configurable", {})
    model_name: str = cfg.get("model_name", _DEFAULT_MODEL)
    user_id: str = cfg.get("user_id")

    # Đọc bộ nhớ dài hạn của user từ SQLite
    memories = []
    if user_id:
        cursor = store_conn.execute("SELECT fact FROM user_memories WHERE user_id = ?", (user_id,))
        memories = [row[0] for row in cursor.fetchall()]
    
    memory_text = ""
    if memories:
        memory_text = "\n\n## Thông tin về người dùng (Bộ nhớ dài hạn)\n- " + "\n- ".join(memories)

    llm = _create_llm(model_name)
    llm_ready = llm.bind_tools(_AGENT_TOOLS, parallel_tool_calls=True)

    system_content = _SYSTEM_PROMPT + memory_text
    messages = [SystemMessage(content=system_content)] + state["messages"]

    response = await llm_ready.ainvoke(messages)
    return {"messages": [response]}


def _should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return END


# ---------------------------------------------------------------------------
# Graph factory
# ---------------------------------------------------------------------------

def build_workflow():
    """Build the LangGraph ReAct workflow.

    Warmup runs eagerly so the first request doesn't pay the
    cold-start penalty (GraphRAG cache + FAISS index + model).
    """
    warmup()
    tool_node = ToolNode(_AGENT_TOOLS)

    workflow = StateGraph(MessagesState)
    workflow.add_node("agent", _call_model)
    workflow.add_node("tools", tool_node)

    workflow.set_entry_point("agent")
    workflow.add_conditional_edges("agent", _should_continue)
    workflow.add_edge("tools", "agent")

    return workflow
