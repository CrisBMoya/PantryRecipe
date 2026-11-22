"""FastAPI server entry point for the PantryRecipe product image extraction agent."""

from __future__ import annotations

import logging
import mimetypes

import uvicorn
from fastapi import Body, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from app.agents import (
    ProductInfo,
    ScannedBarcodeItem,
    ScannedBarcodesSyncResponse,
    arun_product_image_agent,
    arun_recipe_agent,
)
from app.agents.nodes import DEFAULT_IMAGE_MIME_TYPE, normalize_image_mime_type

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="PantryRecipe API",
    description="Backend API and LangGraph agent workflows for PantryRecipe.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_upload_mime_type(upload: UploadFile) -> str:
    """Resolve the image MIME type from an UploadFile's content_type or filename."""
    if upload.content_type and upload.content_type.startswith("image/"):
        return normalize_image_mime_type(upload.content_type)
    if upload.filename:
        guessed, _ = mimetypes.guess_type(upload.filename)
        if guessed and guessed.startswith("image/"):
            return guessed
    return DEFAULT_IMAGE_MIME_TYPE


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    """Return service health status."""
    return {"status": "ok"}


@app.post(
    "/products/analyze",
    response_model=ProductInfo,
    tags=["products"],
    summary="Extract product info from a multipart image upload",
)
async def analyze_product_image(
    image: UploadFile = File(..., description="Retail product packaging image file."),
    barcode: str | None = Form(default=None, description="Scanned product barcode."),
) -> ProductInfo:
    """Receive an uploaded image file (multipart/form-data) and extract product_name and brand."""
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image file is empty.",
        )

    mime_type = _resolve_upload_mime_type(image)
    product_info = await arun_product_image_agent(
        image_bytes,
        mime_type=mime_type,
        barcode=barcode,
    )
    logger.info(
        "Product analyzed (/products/analyze) | barcode=%s | product_name=%r | brand=%r",
        barcode,
        product_info.product_name,
        product_info.brand,
    )
    return product_info


@app.post(
    "/products/analyze-bytes",
    response_model=ProductInfo,
    tags=["products"],
    summary="Extract product info from raw binary image bytes in the request body",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "image/jpeg": {"schema": {"type": "string", "format": "binary"}},
                "image/png": {"schema": {"type": "string", "format": "binary"}},
                "image/webp": {"schema": {"type": "string", "format": "binary"}},
                "application/octet-stream": {
                    "schema": {"type": "string", "format": "binary"}
                },
            },
        }
    },
)
async def analyze_product_image_bytes(
    request: Request,
    barcode: str | None = Query(default=None, description="Scanned product barcode."),
) -> ProductInfo:
    """Receive raw binary image data in the HTTP body and extract product_name and brand."""
    image_bytes = await request.body()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body must contain non-empty binary image data.",
        )

    resolved_barcode = barcode or request.headers.get("x-barcode")
    content_type = request.headers.get("content-type")
    mime_type = normalize_image_mime_type(content_type)
    product_info = await arun_product_image_agent(
        image_bytes,
        mime_type=mime_type,
        barcode=resolved_barcode,
    )
    logger.info(
        "Product analyzed (/products/analyze-bytes) | barcode=%s | product_name=%r | brand=%r",
        resolved_barcode,
        product_info.product_name,
        product_info.brand,
    )
    return product_info


@app.post(
    "/products/scanned-barcodes",
    response_model=ScannedBarcodesSyncResponse,
    tags=["products"],
    summary="Receive and parse all elements from scanned_barcodes.json",
)
async def receive_scanned_barcodes(
    payload: list[ScannedBarcodeItem] | dict[str, list[ScannedBarcodeItem]] = Body(
        ...,
        description="Array of entries (or object containing 'items'/'barcodes') from scanned_barcodes.json.",
    ),
) -> ScannedBarcodesSyncResponse:
    """Receive the elements from scanned_barcodes.json (product titles, brands, and web results) and log them."""
    if isinstance(payload, dict):
        raw_items = payload.get("items") or payload.get("barcodes") or []
    else:
        raw_items = payload

    normalized_items: list[ScannedBarcodeItem] = []
    logger.info(
        "Received scanned_barcodes.json (/products/scanned-barcodes) | total_items=%d",
        len(raw_items),
    )

    for index, item in enumerate(raw_items, start=1):
        product_name = item.resolved_product_name
        brand = item.resolved_brand
        search_result = item.resolved_search_result

        product_info = (
            ProductInfo(
                product_name=product_name or "",
                brand=brand or "",
                search_result=search_result,
            )
            if (product_name or brand or search_result)
            else item.productInfo
        )

        normalized = item.model_copy(
            update={
                "product_name": product_name,
                "brand": brand,
                "search_result": search_result,
                "productInfo": product_info,
            }
        )
        normalized_items.append(normalized)

        logger.info(
            "  [%d/%d] barcode=%s | type=%s | product_name=%r | brand=%r | search_result=%r",
            index,
            len(raw_items),
            normalized.data,
            normalized.type,
            normalized.product_name,
            normalized.brand,
            normalized.search_result,
        )

    recipe_suggestion = await arun_recipe_agent(normalized_items)

    return ScannedBarcodesSyncResponse(
        status="ok",
        received_count=len(normalized_items),
        items=normalized_items,
        recipe_suggestion=recipe_suggestion,
    )


def main() -> None:
    """Run the FastAPI server with Uvicorn."""
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()

