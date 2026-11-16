"""Node functions for the LangGraph agent workflow."""

from __future__ import annotations

import base64

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.agents.state import AgentState, ProductInfo
from app.config import get_llm

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
    structured_llm = llm.with_structured_output(ProductInfo)

    state_messages = list(state.get("messages") or [])
    if not state_messages and state.get("image_bytes"):
        state_messages = [
            build_image_human_message(
                state["image_bytes"],
                mime_type=state.get("mime_type"),
            )
        ]

    messages = [SystemMessage(content=SYSTEM_PROMPT), *state_messages]
    extracted: ProductInfo = structured_llm.invoke(messages)

    return {
        "product_info": extracted,
        "messages": [AIMessage(content=extracted.model_dump_json(indent=2))],
    }

