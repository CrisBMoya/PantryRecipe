"""LangGraph StateGraph assembly and execution helpers."""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.nodes import (
    DEFAULT_IMAGE_MIME_TYPE,
    build_image_human_message,
    call_gemini_node,
    normalize_image_mime_type,
)
from app.agents.state import AgentState, ProductInfo


def build_product_agent_graph() -> CompiledStateGraph:
    """Construct and compile the retail product extraction LangGraph workflow."""
    workflow = StateGraph(AgentState)

    workflow.add_node("agent", call_gemini_node)

    workflow.add_edge(START, "agent")
    workflow.add_edge("agent", END)

    return workflow.compile()


def run_product_image_agent(
    image_bytes: bytes,
    mime_type: str | None = DEFAULT_IMAGE_MIME_TYPE,
    barcode: str | None = None,
) -> ProductInfo:
    """Execute the product image extraction graph on binary image data and return ProductInfo."""
    resolved_mime = normalize_image_mime_type(mime_type)
    graph = build_product_agent_graph()
    human_message = build_image_human_message(image_bytes, mime_type=resolved_mime)
    result = graph.invoke(
        {
            "image_bytes": image_bytes,
            "mime_type": resolved_mime,
            "barcode": barcode,
            "messages": [human_message],
        }
    )
    return result["product_info"]


async def arun_product_image_agent(
    image_bytes: bytes,
    mime_type: str | None = DEFAULT_IMAGE_MIME_TYPE,
    barcode: str | None = None,
) -> ProductInfo:
    """Asynchronously execute the product image extraction graph on binary image data."""
    resolved_mime = normalize_image_mime_type(mime_type)
    graph = build_product_agent_graph()
    human_message = build_image_human_message(image_bytes, mime_type=resolved_mime)
    result = await graph.ainvoke(
        {
            "image_bytes": image_bytes,
            "mime_type": resolved_mime,
            "barcode": barcode,
            "messages": [human_message],
        }
    )
    return result["product_info"]

