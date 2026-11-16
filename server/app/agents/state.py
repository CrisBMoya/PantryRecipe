"""Shared state definitions for LangGraph agent flows."""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """Conversation state passed between nodes in the LangGraph workflow."""

    messages: Annotated[list[AnyMessage], add_messages]
