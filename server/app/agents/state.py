"""Shared state and Pydantic schema definitions for LangGraph agent flows."""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field


class ProductExtraction(BaseModel):
    """Structured data extracted from retail product packaging by the vision model."""

    product_name: str = Field(
        description=(
            'The generic name of the item (e.g., "Granulated White Sugar", '
            '"All-Purpose Flour").'
        )
    )
    brand: str = Field(
        description="The brand or manufacturer name."
    )


class ProductInfo(ProductExtraction):
    """Product metadata and grounded web search details returned by the agent workflow."""

    search_result: str | None = Field(
        default=None,
        description="Product details, contents, and usage summary extracted via Gemini web search.",
    )


class AgentState(TypedDict, total=False):
    """State passed between nodes in the LangGraph product extraction workflow."""

    messages: Annotated[list[AnyMessage], add_messages]
    image_bytes: bytes
    mime_type: str
    barcode: str | None
    product_info: ProductInfo
    search_query: str
    search_result: str

