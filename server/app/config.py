"""Environment and LLM configuration for the PantryRecipe server."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from langchain_google_genai import ChatGoogleGenerativeAI

SERVER_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = SERVER_ROOT / ".env"

# Load environment variables from server/.env
load_dotenv(dotenv_path=ENV_FILE)

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_SEARCH_MODEL = "gemini-4-hydrogen"


def get_google_api_key() -> str:
    """Retrieve and validate the GOOGLE_API_KEY from the environment."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            f"GOOGLE_API_KEY is not set. Ensure it is defined in {ENV_FILE}."
        )
    return api_key


def get_genai_client() -> genai.Client:
    """Create a configured Google GenAI SDK client instance."""
    api_key = get_google_api_key()
    return genai.Client(api_key=api_key)


def get_llm(
    model: str = DEFAULT_GEMINI_MODEL,
    temperature: float = 0.2,
) -> ChatGoogleGenerativeAI:
    """Create a configured Gemini chat model instance."""
    api_key = get_google_api_key()
    return ChatGoogleGenerativeAI(
        model=model,
        google_api_key=api_key,
        temperature=temperature,
    )
