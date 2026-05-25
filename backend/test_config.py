import asyncio
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, MessagesState
from langgraph.prebuilt import ToolNode

@tool
def test_tool(config: RunnableConfig) -> str:
    """Docstring for test tool."""
    user_id = config.get("configurable", {}).get("user_id")
    return f"tool_user_id={user_id}"

workflow = StateGraph(MessagesState)
tool_node = ToolNode([test_tool])

def _call_model(state, config):
    if len(state["messages"]) == 0:
        return {"messages": [{"role": "assistant", "content": "", "tool_calls": [{"name": "test_tool", "args": {}, "id": "1"}]}]}
    return {"messages": [{"role": "assistant", "content": "done"}]}

workflow.add_node("agent", _call_model)
workflow.add_node("tools", tool_node)
workflow.set_entry_point("agent")
workflow.add_edge("agent", "tools")
workflow.add_edge("tools", "agent")
app = workflow.compile()

async def main():
    async for event in app.astream_events(
        {"messages": []},
        {"configurable": {"user_id": "test_user_from_config"}},
        version="v2"
    ):
        if event["event"] == "on_tool_end":
            print("Tool output:", event["data"]["output"])

if __name__ == "__main__":
    asyncio.run(main())
