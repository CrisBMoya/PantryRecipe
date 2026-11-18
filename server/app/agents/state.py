"""Shared state and Pydantic schema definitions for LangGraph agent flows."""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field


class ProductInfo(BaseModel):
    """Structured data extracted from retail product packaging."""

    product_name: str = Field(
        description=(
            'The generic name of the item (e.g., "Granulated White Sugar", '
            '"All-Purpose Flour").'
        )
    )
    brand: str = Field(
        description="The brand or manufacturer name."
    )


class AgentState(TypedDict, total=False):
    """State passed between nodes in the LangGraph product extraction workflow."""

    messages: Annotated[list[AnyMessage], add_messages]
    image_bytes: bytes
    mime_type: str
    barcode: str | None
    product_info: ProductInfo

