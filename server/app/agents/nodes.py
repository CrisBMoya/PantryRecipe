"""Node functions for the LangGraph agent workflow."""

from __future__ import annotations

import base64
import logging

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.agents.state import (
    AgentState,
    ProductExtraction,
    ProductInfo,
    RecipeAgentState,
    ScannedBarcodeItem,
)
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


RECIPE_SYSTEM_PROMPT = (
    "You are an expert culinary chef assistant for PantryRecipe. "
    "You receive a list of pantry products scanned by the user, including their "
    "product titles, brands, and web search details (ingredients, contents, and usage). "
    "Suggest a practical, delicious cooking recipe that makes primary use of these "
    "available items. Format the response clearly with:\n"
    "1. Recipe Title & Brief Description\n"
    "2. Prep/Cook Time & Servings\n"
    "3. Ingredients (highlighting the user's scanned pantry items and listing any basic kitchen staples needed)\n"
    "4. Step-by-Step Cooking Instructions"
)


def format_pantry_items_prompt(items: list[ScannedBarcodeItem]) -> str:
    """Format scanned barcode items into a structured prompt listing product titles, brands, and web results."""
    if not items:
        return "No pantry items were provided."

    lines: list[str] = [
        f"Here are the {len(items)} pantry items from scanned_barcodes.json:"
    ]
    for index, item in enumerate(items, start=1):
        product_name = item.resolved_product_name or "Unknown Product"
        brand = item.resolved_brand or "Unknown Brand"
        search_result = item.resolved_search_result or "No additional web details available."
        lines.append(
            f"\nItem {index}:\n"
            f"- Barcode: {item.data}\n"
            f"- Product Title: {product_name}\n"
            f"- Brand: {brand}\n"
            f"- Product Details / Web Search Result: {search_result}"
        )

    lines.append(
        "\nBased on these pantry products, please suggest a complete cooking recipe."
    )
    return "\n".join(lines)


def prepare_pantry_context_node(state: RecipeAgentState) -> dict:
    """Build the formatted pantry summary prompt and initial HumanMessage from scanned items."""
    items = list(state.get("items") or [])
    pantry_summary = format_pantry_items_prompt(items)
    return {
        "pantry_summary": pantry_summary,
        "messages": [HumanMessage(content=pantry_summary)],
    }


def suggest_recipe_node(state: RecipeAgentState) -> dict:
    """Invoke the Gemini LLM to generate a cooking recipe based on the scanned pantry items."""
    items = list(state.get("items") or [])
    if not items:
        fallback = (
            "No products were found in scanned_barcodes.json. "
            "Please scan at least one product before requesting a recipe suggestion."
        )
        return {
            "recipe_suggestion": fallback,
            "messages": [AIMessage(content=fallback)],
        }

    llm = get_llm(temperature=0.4)
    state_messages = list(state.get("messages") or [])
    if not state_messages:
        pantry_summary = state.get("pantry_summary") or format_pantry_items_prompt(items)
        state_messages = [HumanMessage(content=pantry_summary)]

    messages = [SystemMessage(content=RECIPE_SYSTEM_PROMPT), *state_messages]
    response = llm.invoke(messages)

    content = response.content
    if isinstance(content, str):
        recipe_text = content.strip()
    else:
        recipe_text = str(content).strip()

    logger.info(
        "[RecipeAgent] Generated recipe suggestion for %d pantry items:\n%s",
        len(items),
        recipe_text,
    )

    return {
        "recipe_suggestion": recipe_text,
        "messages": [AIMessage(content=recipe_text)],
    }


