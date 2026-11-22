"""LangGraph StateGraph assembly and execution helpers."""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.nodes import (
    DEFAULT_IMAGE_MIME_TYPE,
    build_image_human_message,
    call_gemini_node,
    normalize_image_mime_type,
    prepare_pantry_context_node,
    suggest_recipe_node,
    web_search_node,
)
from app.agents.state import (
    AgentState,
    ProductInfo,
    RecipeAgentState,
    ScannedBarcodeItem,
)


def build_product_agent_graph() -> CompiledStateGraph:
    """Construct and compile the retail product extraction LangGraph workflow."""
    workflow = StateGraph(AgentState)

    workflow.add_node("agent", call_gemini_node)
    workflow.add_node("web_search", web_search_node)

    workflow.add_edge(START, "agent")
    workflow.add_edge("agent", "web_search")
    workflow.add_edge("web_search", END)

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


def build_recipe_agent_graph() -> CompiledStateGraph:
    """Construct and compile the pantry recipe suggestion LangGraph workflow."""
    workflow = StateGraph(RecipeAgentState)

    workflow.add_node("prepare_context", prepare_pantry_context_node)
    workflow.add_node("suggest_recipe", suggest_recipe_node)

    workflow.add_edge(START, "prepare_context")
    workflow.add_edge("prepare_context", "suggest_recipe")
    workflow.add_edge("suggest_recipe", END)

    return workflow.compile()


def run_recipe_agent(items: list[ScannedBarcodeItem]) -> str:
    """Execute the recipe suggestion agent graph synchronously on a list of scanned items."""
    graph = build_recipe_agent_graph()
    result = graph.invoke({"items": items})
    return result["recipe_suggestion"]


async def arun_recipe_agent(items: list[ScannedBarcodeItem]) -> str:
    """Asynchronously execute the recipe suggestion agent graph on a list of scanned items."""
    graph = build_recipe_agent_graph()
    result = await graph.ainvoke({"items": items})
    return result["recipe_suggestion"]

