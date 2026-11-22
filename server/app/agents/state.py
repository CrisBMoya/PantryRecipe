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


class ScannedBarcodeItem(BaseModel):
    """Single entry from scanned_barcodes.json sent by the Android client."""

    data: str = Field(description="Scanned barcode value.")
    type: str | None = Field(default=None, description="Barcode symbology type.")
    firstScannedAt: int | None = Field(
        default=None, description="First scan timestamp (ms)."
    )
    lastScannedAt: int | None = Field(
        default=None, description="Most recent scan timestamp (ms)."
    )
    scanCount: int | None = Field(
        default=1, description="Number of times this barcode was scanned."
    )
    frontPhotoUri: str | None = Field(
        default=None, description="Local device URI for the front product photo."
    )
    product_name: str | None = Field(
        default=None, description="Extracted generic product title."
    )
    brand: str | None = Field(
        default=None, description="Extracted product brand or manufacturer."
    )
    search_result: str | None = Field(
        default=None,
        description="Web search details, contents, and usage summary for the product.",
    )
    productInfo: ProductInfo | None = Field(
        default=None,
        description="Nested product metadata object stored alongside the barcode.",
    )

    @property
    def resolved_product_name(self) -> str | None:
        """Return product_name from top-level field or nested productInfo."""
        if self.product_name and self.product_name.strip():
            return self.product_name.strip()
        if self.productInfo and self.productInfo.product_name.strip():
            return self.productInfo.product_name.strip()
        return None

    @property
    def resolved_brand(self) -> str | None:
        """Return brand from top-level field or nested productInfo."""
        if self.brand and self.brand.strip():
            return self.brand.strip()
        if self.productInfo and self.productInfo.brand.strip():
            return self.productInfo.brand.strip()
        return None

    @property
    def resolved_search_result(self) -> str | None:
        """Return search_result from top-level field or nested productInfo."""
        if self.search_result and self.search_result.strip():
            return self.search_result.strip()
        if (
            self.productInfo
            and self.productInfo.search_result
            and self.productInfo.search_result.strip()
        ):
            return self.productInfo.search_result.strip()
        return None


class ScannedBarcodesSyncResponse(BaseModel):
    """Response returned by the server after receiving scanned_barcodes.json."""

    status: str = Field(default="ok", description="Processing status.")
    received_count: int = Field(
        description="Total number of barcode items received from scanned_barcodes.json."
    )
    items: list[ScannedBarcodeItem] = Field(
        default_factory=list,
        description="Parsed items received from scanned_barcodes.json.",
    )
    recipe_suggestion: str | None = Field(
        default=None,
        description="Cooking recipe suggested by the agent based on the received pantry items.",
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


class RecipeAgentState(TypedDict, total=False):
    """State passed between nodes in the LangGraph recipe suggestion workflow."""

    messages: Annotated[list[AnyMessage], add_messages]
    items: list[ScannedBarcodeItem]
    pantry_summary: str
    recipe_suggestion: str

