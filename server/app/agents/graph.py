"""LangGraph StateGraph assembly and execution helpers."""

from __future__ import annotations

from langchain_core.messages import HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.nodes import call_gemini_node
from app.agents.state import AgentState


def build_hello_agent_graph() -> CompiledStateGraph:
    """Construct and compile the Hello World LangGraph workflow."""
    workflow = StateGraph(AgentState)

    workflow.add_node("agent", call_gemini_node)

    workflow.add_edge(START, "agent")
    workflow.add_edge("agent", END)

    return workflow.compile()


def run_hello_agent(prompt: str = "Hello! Who are you?") -> str:
    """Execute the Hello World agent graph with a user prompt and return the reply."""
    graph = build_hello_agent_graph()
    result = graph.invoke({"messages": [HumanMessage(content=prompt)]})
    last_message = result["messages"][-1]
    return str(last_message.content)
