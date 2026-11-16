# PantryRecipe — Agent & LLM Architecture Guide

This is an **Expo SDK 58 / React Native 0.88 / TypeScript** mobile application (primarily targeting Android).
Because multiple LLMs and fresh sessions work on this repository, adhere strictly to the architectural boundaries and invariants below.

---

## 1. Tech Stack & Entry Point
- **Framework:** Expo (`~58.0.25`), React 19 (`19.3.0`), React Native (`0.88.1`), TypeScript (`~6.0.3`).
- **Entry Point:** `index.ts` -> `App.tsx` (Currently using standard root registration via `registerRootComponent(App)`. *Note: `expo-router` is NOT currently installed; do not import `expo-router` unless explicitly asked to migrate routing*).
- **Camera & Barcode:** `expo-camera` (`CameraView`, `useCameraPermissions`).
- **Local Storage:** `expo-file-system` (`File`, `Directory`, `Paths.document`) for persisting scanned barcodes (`scanned_barcodes.json`) and captured front product photos (`product_photos/`) on device for future API upload.

---

## 2. Directory Structure & Responsibilities

```text
├── App.tsx                             # Root application component & screen host
├── app.json                            # Expo config & native permissions (Android CAMERA)
├── server/                             # Python backend & LangGraph AI agent server (managed via UV)
│   ├── pyproject.toml                  # Python project dependencies (langgraph, langchain, langchain-google-genai, python-dotenv)
│   ├── main.py                         # Entry point for running the LangGraph agent flow
│   └── app/
│       ├── config.py                   # Environment loader (server/.env -> GOOGLE_API_KEY) & Gemini LLM factory
│       └── agents/
│           ├── state.py                # LangGraph AgentState definition
│           ├── nodes.py                # LangGraph node functions (Gemini invocation)
│           └── graph.py                # StateGraph builder & execution helpers
├── src/
│   ├── components/
│   │   └── BarcodeScannerView.tsx      # Camera viewfinder, reticle, scan result & front product photo capture UI
│   ├── hooks/
│   │   └── useBarcodeScanner.ts        # Multi-frame consensus, scan state, and front photo attachment hook
│   ├── types/
│   │   └── barcode.ts                  # Shared TypeScript interfaces (ScannedBarcode, StoredBarcodeEntry, etc.)
│   └── utils/
│       ├── barcodeStorage.ts           # Local device persistence for barcodes (scanned_barcodes.json) & photos (product_photos/)
│       └── barcodeValidator.ts         # Pure GS1 Modulo-10 checksum & format validators
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

3. **React Native 0.88+ StyleSheet Compatibility:**
   - Use `...StyleSheet.absoluteFill` (NOT `StyleSheet.absoluteFillObject`, which is removed from RN 0.88 type definitions).

4. **Continuous Native Generation (CNG):**
   - `android/` and `ios/` directories are generated on demand. Configure permissions and plugins in `app.json` rather than editing native folders directly.

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
- **LLM & Framework:** LangChain + LangGraph (`StateGraph`) using Gemini (`langchain-google-genai`) configured via `GOOGLE_API_KEY` in `server/.env`.
- **Running the Agent:**
  ```powershell
  cd server
  $env:UV_PROJECT_ENVIRONMENT="C:\Users\Tobal\virtual_environments\server\.venv"
  uv run python main.py
  ```

