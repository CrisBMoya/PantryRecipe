"""Entry point for running the PantryRecipe product image extraction LangGraph agent."""

from __future__ import annotations

import argparse
from pathlib import Path

from app.agents import run_product_image_agent

DEFAULT_IMAGE_PATH = Path(__file__).resolve().parent / "sample_product.jpg"


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments for the local product image path."""
    parser = argparse.ArgumentParser(
        description="Extract structured product info (product_name, brand) from a local retail product image."
    )
    parser.add_argument(
        "image_path",
        nargs="?",
        default=str(DEFAULT_IMAGE_PATH),
        help="Path to the local retail product image (default: server/sample_product.jpg).",
    )
    return parser.parse_args()


def main() -> None:
    """Run the product image through the Gemini LangGraph agent and print valid JSON."""
    args = parse_args()
    product_info = run_product_image_agent(args.image_path)
    print(product_info.model_dump_json(indent=2))


if __name__ == "__main__":
    main()

