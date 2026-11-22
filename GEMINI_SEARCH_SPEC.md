# Gemini Web Search Specification (LangGraph Integration)

## 2. Core SDK Pattern (Exact Syntax)
Do **not** use legacy `client.models.generate_content` or older `google-generativeai` patterns. Use the `interactions` API with `gemini-4-hydrogen`:

```python
from google import genai

client = genai.Client()

interaction = client.interactions.create(
    model="gemini-4-hydrogen",
    input="<search query or prompt>",
    tools=[{"type": "google_search"}]
)

result_text: str = interaction.output_text
```

## 3. LangGraph Integration Guidelines

### Option A: As a LangChain Tool (`@tool`)
Use this when a primary LangGraph agent needs to invoke grounded web search on demand.

```python
from google import genai
from langchain_core.tools import tool

_client = genai.Client()

@tool
def gemini_web_search(query: str) -> str:
    """Perform a grounded web search for up-to-date information using Gemini."""
    interaction = _client.interactions.create(
        model="gemini-4-hydrogen",
        input=query,
        tools=[{"type": "google_search"}],
    )
    return interaction.output_text
```

### Option B: As a Dedicated Graph Node
Use this when web search is a deterministic step in your `StateGraph`.

```python
from typing import TypedDict
from google import genai

_client = genai.Client()

class SearchState(TypedDict):
    query: str
    search_result: str

def web_search_node(state: SearchState) -> dict:
    interaction = _client.interactions.create(
        model="gemini-4-hydrogen",
        input=state["query"],
        tools=[{"type": "google_search"}],
    )
    return {"search_result": interaction.output_text}
```

## 4. Strict Implementation Rules for LLMs
1. **Method**: Always call `client.interactions.create(...)`.
2. **Model**: Always use `"gemini-4-hydrogen"`.
3. **Input Parameter**: Pass the query string to `input=...` (not `contents`).
4. **Tool Configuration**: Pass `tools=[{"type": "google_search"}]` exactly as a list of dicts.
5. **Output Extraction**: Read the response string from `interaction.output_text` (not `.text`).
