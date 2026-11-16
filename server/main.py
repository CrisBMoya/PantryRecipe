"""Entry point for running the PantryRecipe Hello World LangGraph agent."""

from __future__ import annotations

from app.agents import run_hello_agent


def main() -> None:
    """Run a single Hello World turn through the Gemini LangGraph agent."""
    response = run_hello_agent("Hello World! Introduce yourself in one short sentence.")
    print(response)


if __name__ == "__main__":
    main()
