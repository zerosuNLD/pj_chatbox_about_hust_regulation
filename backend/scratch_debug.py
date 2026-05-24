import asyncio
import os
from standard_graph import build_workflow, _DEFAULT_MODEL
from langchain_core.messages import HumanMessage

async def main():
    workflow = build_workflow()
    from langgraph.checkpoint.sqlite import SqliteSaver
    with SqliteSaver.from_conn_string(":memory:") as checkpointer:
        agent = workflow.compile(checkpointer=checkpointer)
    question = "chào bạn"
    config = {"configurable": {"thread_id": "test_123", "user_id": "test"}}
    
    print("Streaming...")
    async for event in agent.astream_events(
        {"messages": [HumanMessage(content=question)]}, config, version="v2"
    ):
        kind = event.get("event", "")
        name = event.get("name", "")
        if kind == "on_chain_end":
            print(f"on_chain_end {name} -> {type(event.get('data', {}).get('output'))}")
        if kind == "on_chat_model_end":
            out = event.get('data', {}).get('output')
            print(f"on_chat_model_end -> {type(out)}: tool_calls={getattr(out, 'tool_calls', 'N/A')}")
            
if __name__ == "__main__":
    asyncio.run(main())
