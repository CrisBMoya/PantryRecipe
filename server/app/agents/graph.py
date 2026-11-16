"""LangGraph StateGraph assembly and execution helpers."""

from __future__ import annotations

from pathlib import Path

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.nodes import build_image_human_message, call_gemini_node
from app.agents.state import AgentState, ProductInfo


def build_product_agent_graph() -> CompiledStateGraph:
    """Construct and compile the retail product extraction LangGraph workflow."""
    workflow = StateGraph(AgentState)

    workflow.add_node("agent", call_gemini_node)

    workflow.add_edge(START, "agent")
    workflow.add_edge("agent", END)

    return workflow.compile()


def run_product_image_agent(image_path: str | Path) -> ProductInfo:
    """Execute the product image extraction graph on a local image and return ProductInfo."""
    graph = build_product_agent_graph()
    human_message = build_image_human_message(image_path)
    result = graph.invoke(
        {
            "image_path": str(image_path),
            "messages": [human_message],
        }
    )
    return result["product_info"]

