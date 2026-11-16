"""Node functions for the LangGraph agent workflow."""

from __future__ import annotations

from langchain_core.messages import SystemMessage

from app.agents.state import AgentState
from app.config import get_llm

SYSTEM_PROMPT = (
    "You are the PantryRecipe AI assistant. "
    "Greet the user warmly with a concise 'Hello World' style message and "
    "briefly mention that you are ready to help manage pantry items and recipes."
)


def call_gemini_node(state: AgentState) -> dict[str, list]:
    """Invoke the Gemini LLM with the current conversation state."""
    llm = get_llm()
    messages = [SystemMessage(content=SYSTEM_PROMPT), *state["messages"]]
    response = llm.invoke(messages)
    return {"messages": [response]}
