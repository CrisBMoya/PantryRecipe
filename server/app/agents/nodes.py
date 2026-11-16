"""Node functions for the LangGraph agent workflow."""

from __future__ import annotations

import base64
import mimetypes
from pathlib import Path

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.agents.state import AgentState, ProductInfo
from app.config import get_llm

SYSTEM_PROMPT = (
    "You are a retail product vision extraction assistant for PantryRecipe. "
    "Examine the provided image of a retail product package (such as a bag of sugar, "
    "flour, or packaged goods), read the packaging text carefully, and extract "
    "the generic product name and the brand/manufacturer name."
)


def encode_image_data_url(image_path: str | Path) -> str:
    """Read a local image file and return a base64-encoded data URL."""
    path = Path(image_path).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Product image not found at: {path}")

    mime_type, _ = mimetypes.guess_type(path.name)
    if not mime_type or not mime_type.startswith("image/"):
        mime_type = "image/jpeg"

    encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def build_image_human_message(
    image_path: str | Path,
    prompt: str = "Identify and describe this retail product package, extracting its product_name and brand.",
) -> HumanMessage:
    """Create a multimodal HumanMessage containing a local image and prompt."""
    data_url = encode_image_data_url(image_path)
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
    if not state_messages and state.get("image_path"):
        state_messages = [build_image_human_message(state["image_path"])]

    messages = [SystemMessage(content=SYSTEM_PROMPT), *state_messages]
    extracted: ProductInfo = structured_llm.invoke(messages)

    return {
        "product_info": extracted,
        "messages": [AIMessage(content=extracted.model_dump_json(indent=2))],
    }

