"""Node functions for the LangGraph agent workflow."""

from __future__ import annotations

import base64
import logging

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.agents.state import AgentState, ProductExtraction, ProductInfo
from app.config import get_genai_client, get_llm

logger = logging.getLogger("uvicorn.error")

SYSTEM_PROMPT = (
    "You are a retail product vision extraction assistant for PantryRecipe. "
    "Examine the provided image of a retail product package (such as a bag of sugar, "
    "flour, or packaged goods), read the packaging text carefully, and extract "
    "the generic product name and the brand/manufacturer name."
)

DEFAULT_IMAGE_MIME_TYPE = "image/jpeg"


def normalize_image_mime_type(mime_type: str | None) -> str:
    """Normalize an image MIME type, defaulting to image/jpeg when unspecified or non-image."""
    if not mime_type:
        return DEFAULT_IMAGE_MIME_TYPE
    cleaned = mime_type.split(";")[0].strip().lower()
    if not cleaned.startswith("image/"):
        return DEFAULT_IMAGE_MIME_TYPE
    return cleaned


def encode_image_data_url(
    image_bytes: bytes,
    mime_type: str | None = DEFAULT_IMAGE_MIME_TYPE,
) -> str:
    """Encode raw binary image bytes into a base64 data URL."""
    if not image_bytes:
        raise ValueError("Image data must not be empty.")

    resolved_mime = normalize_image_mime_type(mime_type)
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{resolved_mime};base64,{encoded}"


def build_image_human_message(
    image_bytes: bytes,
    mime_type: str | None = DEFAULT_IMAGE_MIME_TYPE,
    prompt: str = "Identify and describe this retail product package, extracting its product_name and brand.",
) -> HumanMessage:
    """Create a multimodal HumanMessage containing binary image data and a prompt."""
    data_url = encode_image_data_url(image_bytes, mime_type=mime_type)
    return HumanMessage(
        content=[
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": data_url}},
        ]
    )


def call_gemini_node(state: AgentState) -> dict:
    """Invoke the Gemini LLM with structured output for product extraction."""
    llm = get_llm()
    structured_llm = llm.with_structured_output(ProductExtraction)

    state_messages = list(state.get("messages") or [])
    if not state_messages and state.get("image_bytes"):
        state_messages = [
            build_image_human_message(
                state["image_bytes"],
                mime_type=state.get("mime_type"),
            )
        ]

    messages = [SystemMessage(content=SYSTEM_PROMPT), *state_messages]
    extracted: ProductExtraction = structured_llm.invoke(messages)
    product_info = ProductInfo(
        product_name=extracted.product_name,
        brand=extracted.brand,
    )

    barcode = state.get("barcode")
    logger.info(
        "[ProductAgent] Extracted product info | barcode=%s | product_name=%r | brand=%r",
        barcode,
        product_info.product_name,
        product_info.brand,
    )

    search_query = build_product_search_query(
        product_name=product_info.product_name,
        brand=product_info.brand,
    )

    return {
        "product_info": product_info,
        "search_query": search_query,
        "messages": [AIMessage(content=product_info.model_dump_json(indent=2))],
    }


def build_product_search_query(product_name: str, brand: str) -> str:
    """Build a search prompt using product_name and brand to extract contents and usage details."""
    return (
        f"Search for retail product '{brand} {product_name}' "
        f"(Brand: {brand}, Product Name: {product_name}). "
        "Provide a concise summary of the product details, including its description, "
        "ingredients/contents, and common culinary or household usage."
    )


@tool
def gemini_web_search(query: str) -> str:
    """Perform a grounded web search for up-to-date information using Gemini."""
    client = get_genai_client()
    interaction = client.interactions.create(
        model="gemini-4-hydrogen",
        input=query,
        tools=[{"type": "google_search"}],
    )
    return interaction.output_text


def web_search_node(state: AgentState) -> dict:
    """Conduct a grounded Gemini web search for the identified product and log the results."""
    product_info = state.get("product_info")
    barcode = state.get("barcode")

    if product_info is not None:
        product_name = product_info.product_name
        brand = product_info.brand
    else:
        product_name = ""
        brand = ""

    query = state.get("search_query") or build_product_search_query(
        product_name=product_name,
        brand=brand,
    )

    client = get_genai_client()
    interaction = client.interactions.create(
        model="gemini-4-hydrogen",
        input=query,
        tools=[{"type": "google_search"}],
    )
    result_text: str = interaction.output_text

    logger.info(
        "[ProductWebSearch] Web search results | barcode=%s | product_name=%r | brand=%r | details=%s",
        barcode,
        product_name,
        brand,
        result_text,
    )

    updated_product_info = ProductInfo(
        product_name=product_name,
        brand=brand,
        search_result=result_text,
    )

    return {
        "product_info": updated_product_info,
        "search_query": query,
        "search_result": result_text,
        "messages": [AIMessage(content=result_text)],
    }


