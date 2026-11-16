# Changelog

All notable changes to this project are documented in this file.

## [0.8.0] - 2026-11-16

### Added
- **Binary Product Photo Upload to Server (`src/utils/productApi.ts`, `src/hooks/useBarcodeScanner.ts`, `src/components/BarcodeScannerView.tsx`, `src/utils/barcodeStorage.ts`, `src/types/barcode.ts`):** Added `uploadProductPhotoBinary` using `expo-file-system` (`File.bytes()`) and `expo/fetch` to automatically send captured front product photographs as raw binary bytes (`POST /products/analyze-bytes`) to the FastAPI backend. Persists the extracted `ProductInfo` (`product_name`, `brand`) in `scanned_barcodes.json`, displays upload progress, retry controls, and extracted product details in the scanner UI, and logs the resolved server URL and port in the app console.

## [0.7.0] - 2026-11-16

### Changed
- **FastAPI Server & Binary Image Agent Ingestion (`server/main.py`, `server/app/agents/`, `server/pyproject.toml`, `AGENTS.md`):** Transformed the Python server into a FastAPI application served via Uvicorn (`fastapi`, `uvicorn`, `python-multipart`). Refactored the LangGraph product extraction workflow (`AgentState`, `encode_image_data_url`, `build_image_human_message`, `run_product_image_agent`, `arun_product_image_agent`) to accept raw binary image bytes (`image_bytes`, `mime_type`) instead of local file paths, exposing `POST /products/analyze` (multipart file upload), `POST /products/analyze-bytes` (raw binary body), and `GET /health`.

## [0.6.0] - 2026-11-16

### Changed
- **Structured Retail Product Image Extraction (`server/app/agents/`, `server/main.py`, `server/pyproject.toml`):** Updated the LangGraph agent workflow to read and base64-encode a local retail product image (`encode_image_data_url`, `build_image_human_message`) and enforce structured output via Pydantic (`ProductInfo` with `product_name` and `brand` fields) using `llm.with_structured_output(ProductInfo)`, printing the validated JSON object in `server/main.py`.

## [0.5.0] - 2026-11-16

### Added
- **LangGraph & Gemini Backend Agent (`server/`):** Initialized the modular Python agent workflow using `langgraph`, `langchain`, `langchain-google-genai`, and `python-dotenv` managed via `uv`. Added `server/app/config.py`, `server/app/agents/` (`state.py`, `nodes.py`, `graph.py`), and `server/main.py` to run a Gemini-powered Hello World `StateGraph` agent using `GOOGLE_API_KEY` from `server/.env`.

## [0.4.0] - 2026-11-16

### Added
- **Front Product Photo Capture & Storage (`src/components/BarcodeScannerView.tsx`, `src/hooks/useBarcodeScanner.ts`, `src/utils/barcodeStorage.ts`, `src/types/barcode.ts`):** When a newly scanned (`new`) barcode is detected, the app now prompts the user to take a **Front product photo** using the camera, copies the image to persistent device storage (`Paths.document/product_photos`), and links `frontPhotoUri` to the stored barcode record in `scanned_barcodes.json` for future API submission.

## [0.3.0] - 2026-11-15

### Changed
- **Manual Scan Trigger (`src/hooks/useBarcodeScanner.ts`, `src/components/BarcodeScannerView.tsx`):** Disabled automatic barcode scanning on app startup. Added `isScanning` state and a **Scan Barcode** button so the camera only looks for barcodes after the user presses the button.

## [0.2.0] - 2026-11-15

### Added
- **Local Device Barcode Storage (`src/utils/barcodeStorage.ts`):** Added `expo-file-system` integration to persist scanned barcodes in a local file (`scanned_barcodes.json`) on the device.
- **New vs. Old Code Detection (`src/hooks/useBarcodeScanner.ts`, `src/types/barcode.ts`):** Checks each verified scan against the local file—saving it if not present (`new`) or flagging it as already saved (`old`).
- **Scan Status UI (`src/components/BarcodeScannerView.tsx`):** Updated the result card to display both the scanned barcode and whether it is a `NEW CODE` or `OLD CODE`.

## [0.1.0] - 2026-11-15

### Added
- **Expo TypeScript Scaffold:** Initialized Android-first mobile app using Expo SDK 58, React Native 0.88, and `expo-camera`.
- **Barcode Scanner Component (`src/components/BarcodeScannerView.tsx`):** Full-screen camera viewfinder with permission handling, status reticle, and scanned result card.
- **High-Precision Scan Pipeline:**
  - **Multi-Frame Consensus (`src/hooks/useBarcodeScanner.ts`):** Requires 3 consecutive identical reads within 1200ms to prevent motion-blur and autofocus misreads.
  - **GS1 Modulo-10 Checksum Validator (`src/utils/barcodeValidator.ts`):** Validates check digits for `ean13`, `ean8`, and `upc_a` barcodes and restricts scanning to reliable formats (`ean13`, `ean8`, `upc_a`, `upc_e`, `code128`, `qr`).
- **Multi-LLM Handoff Documentation:** Added `AGENTS.md`, `GEMINI.md`, and updated `README.md` with project structure and core scanner invariants.
