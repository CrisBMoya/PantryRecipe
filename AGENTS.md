# PantryRecipe — Agent & LLM Architecture Guide

This is a full-stack repository comprising:
1. **Mobile Client (Root):** An **Expo SDK 58 / React Native 0.88 / TypeScript** mobile application (primarily targeting Android).
2. **Backend & AI Agent Server (`server/`):** A **Python (>=3.14) / LangChain / LangGraph** server using **Google Gemini** (`langchain-google-genai`) and managed with **UV**.

Because multiple LLMs and fresh sessions work on this repository, adhere strictly to the architectural boundaries and invariants below.

---

## 1. Tech Stack & Entry Points
- **Mobile Framework:** Expo (`~58.0.25`), React 19 (`19.3.0`), React Native (`0.88.1`), TypeScript (`~6.0.3`).
- **Mobile Entry Point:** `index.ts` -> `App.tsx` (Currently using standard root registration via `registerRootComponent(App)`. *Note: `expo-router` is NOT currently installed; do not import `expo-router` unless explicitly asked to migrate routing*).
- **Camera & Barcode:** `expo-camera` (`CameraView`, `useCameraPermissions`).
- **Local Storage:** `expo-file-system` (`File`, `Directory`, `Paths.document`) for persisting scanned barcodes (`scanned_barcodes.json`) and captured front product photos (`product_photos/`) on device for future API upload.
- **Backend & Agent Framework (`server/`):** Python `>=3.14` managed with `uv`, `fastapi`, `uvicorn`, `python-multipart`, `langgraph`, `langchain`, `langchain-google-genai` (default model `gemini-2.5-flash`), `pydantic`, and `python-dotenv`.
- **Backend Entry Point:** `server/main.py` (`FastAPI` app `main:app`) -> `server/app/agents/graph.py` (`arun_product_image_agent` / `run_product_image_agent`).

---

## 2. Directory Structure & Responsibilities

```text
├── App.tsx                             # Root application component & screen host
├── app.json                            # Expo config & native permissions (Android CAMERA)
├── server/                             # Python FastAPI backend & LangGraph AI agent server (managed via UV)
│   ├── .env                            # Local secrets (GOOGLE_API_KEY) — gitignored, never commit or log
│   ├── pyproject.toml                  # Python project dependencies (fastapi, uvicorn, python-multipart, langgraph, langchain, langchain-google-genai, pydantic, python-dotenv)
│   ├── uv.lock                         # Locked UV dependency graph
│   ├── main.py                         # FastAPI application entry point exposing product image extraction endpoints
│   └── app/
│       ├── config.py                   # Environment loader (server/.env -> GOOGLE_API_KEY), Gemini LLM factory (get_llm), & GenAI SDK client factory (get_genai_client)
│       └── agents/
│           ├── state.py                # LangGraph AgentState & Pydantic schemas (ProductExtraction, ProductInfo with product_name, brand, search_result)
│           ├── nodes.py                # Binary image base64 encoding, Gemini vision structured-output node (call_gemini_node), & grounded web search node (web_search_node)
│           └── graph.py                # StateGraph builder & execution helpers (build_product_agent_graph, run_product_image_agent, arun_product_image_agent)
├── src/
│   ├── components/
│   │   └── BarcodeScannerView.tsx      # Camera viewfinder, reticle, scan result & front product photo capture UI
│   ├── hooks/
│   │   └── useBarcodeScanner.ts        # Multi-frame consensus, scan state, and front photo attachment hook
│   ├── types/
│   │   └── barcode.ts                  # Shared TypeScript interfaces (ScannedBarcode, StoredBarcodeEntry, ProductInfo, etc.)
│   └── utils/
│       ├── barcodeStorage.ts           # Local device persistence for barcodes (scanned_barcodes.json) & photos (product_photos/)
│       ├── barcodeValidator.ts         # Pure GS1 Modulo-10 checksum & format validators
│       └── productApi.ts               # Binary POST client (uploadProductPhotoBinary) sending photo bytes to /products/analyze-bytes
```

---

## 3. Core Invariants (DO NOT BREAK)

1. **Barcode Precision & Anti-Misread Pipeline:**
   - Raw single-frame reads from `CameraView.onBarcodeScanned` are prone to motion-blur and autofocus misreads.
   - **Never** wire `CameraView.onBarcodeScanned` directly to state without going through `useBarcodeScanner` (`src/hooks/useBarcodeScanner.ts`) and `isBarcodeValid` (`src/utils/barcodeValidator.ts`).
   - **Manual Scan Trigger:** Scanning starts idle (`isScanning = false`) and is only active after calling `startScanning()` until a barcode is verified.
   - **Checksum Enforcement:** `ean13`, `ean8`, and `upc_a` barcodes must pass GS1 Modulo-10 check digit verification (`isValidGtinChecksum`).
   - **Multi-Frame Consensus:** A barcode must be read identically across `DEFAULT_REQUIRED_CONSECUTIVE_READS` (3) consecutive frames within `DEFAULT_CONSENSUS_TIMEOUT_MS` (1200ms) before firing `onScanned`.
   - **Supported Symbologies:** Keep `SUPPORTED_BARCODE_TYPES` limited to reliable formats (`ean13`, `ean8`, `upc_a`, `upc_e`, `code128`, `qr`) unless specifically requested otherwise.

2. **New vs. Old Barcode Storage & Front Product Photo Workflow:**
   - Every verified barcode is checked against `Paths.document/scanned_barcodes.json` via `checkAndSaveBarcode` (`src/utils/barcodeStorage.ts`) and tagged with `status: 'new' | 'old'`.
   - When a barcode is `'new'` (or missing `frontPhotoUri`), `BarcodeScannerView` prompts the user to capture a **Front product photo** using `CameraView.takePictureAsync`.
   - Captured photos must be copied from temporary camera cache into persistent storage (`Paths.document/product_photos/<barcode>_front_<timestamp>.jpg`) via `saveFrontProductPhoto` / `attachFrontPhoto`, updating `frontPhotoUri` on the stored entry so it remains available for future API uploads to the backend server.
   - When the server extracts `ProductInfo` (`product_name`, `brand`, and `search_result`), `saveProductInfoForBarcode` persists `product_name`, `brand`, and `search_result` directly alongside the barcode in `scanned_barcodes.json` (as well as inside `productInfo`), and `deleteStoredBarcode` removes an entry and its associated photo file from local storage.

3. **React Native 0.88+ StyleSheet Compatibility:**
   - Use `...StyleSheet.absoluteFill` (NOT `StyleSheet.absoluteFillObject`, which is removed from RN 0.88 type definitions).

4. **Continuous Native Generation (CNG):**
   - `android/` and `ios/` directories are generated on demand. Configure permissions and plugins in `app.json` rather than editing native folders directly.

5. **Python Server & LangGraph Conventions (`server/`):**
   - **External UV Virtual Environment:** Do NOT create a local `.venv` inside `server/`. Always target the existing virtual environment at `C:\Users\Tobal\virtual_environments\server\.venv\` by setting `UV_PROJECT_ENVIRONMENT="C:\Users\Tobal\virtual_environments\server\.venv"` when running `uv add`, `uv sync`, or `uv run`.
   - **LLM Instantiation & Secrets:** Always instantiate Gemini models through `get_llm()` or `get_genai_client()` in `server/app/config.py`, which loads `GOOGLE_API_KEY` from `server/.env`. Never hardcode API keys or commit `server/.env`.
   - **Modular Graph Architecture:** Keep LangGraph state and Pydantic schemas (`state.py`), node functions (`nodes.py`), and graph wiring (`graph.py`) separated under `server/app/agents/` so new nodes, tools, and API endpoints can be added cleanly.
   - **Structured Product Image Extraction & Grounded Web Search:** Retail product packaging images are passed as binary image bytes (`image_bytes`, `mime_type`), encoded as base64 data URLs (`encode_image_data_url` / `build_image_human_message` in `nodes.py`), and processed via `llm.with_structured_output(ProductExtraction)` in `call_gemini_node` to guarantee valid JSON extraction of `product_name` and `brand`. The graph then runs `web_search_node`, which conducts a grounded search using `client.interactions.create(model="gemini-4-hydrogen", input=..., tools=[{"type": "google_search"}])` and reads `interaction.output_text` (per `GEMINI_SEARCH_SPEC.md`), logging the results and returning `ProductInfo` (`product_name`, `brand`, `search_result`).

---

## 4. Key Commands & Verification

Always run typechecking before completing any task:

```bash
npx expo install <package>  # ALWAYS use instead of npm install to resolve SDK-58 compatible versions
npx tsc --noEmit            # Run TypeScript compiler check (MUST pass with 0 errors)
npm run start               # Start Expo development server
npm run android             # Start on Android device/emulator
```

### Python Backend (`server/`)
- **Package & Environment Manager:** `uv` (Python >= 3.14).
- **External Virtual Environment:** Located at `C:\Users\Tobal\virtual_environments\server\.venv\`. Always pass `--python "C:\Users\Tobal\virtual_environments\server\.venv"` or set `UV_PROJECT_ENVIRONMENT="C:\Users\Tobal\virtual_environments\server\.venv"` when running `uv` commands inside `server/`.
- **API & Agent Framework:** FastAPI + Uvicorn + LangChain + LangGraph (`StateGraph`) using Gemini (`langchain-google-genai`) and Pydantic structured output (`ProductInfo`), configured via `GOOGLE_API_KEY` in `server/.env`.
- **Running the FastAPI Server:**
  ```powershell
  cd server
  $env:UV_PROJECT_ENVIRONMENT="C:\Users\Tobal\virtual_environments\server\.venv"
  uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  ```

