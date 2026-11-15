# PantryRecipe — Agent & LLM Architecture Guide

This is an **Expo SDK 58 / React Native 0.88 / TypeScript** mobile application (primarily targeting Android).
Because multiple LLMs and fresh sessions work on this repository, adhere strictly to the architectural boundaries and invariants below.

---

## 1. Tech Stack & Entry Point
- **Framework:** Expo (`~58.0.25`), React 19 (`19.3.0`), React Native (`0.88.1`), TypeScript (`~6.0.3`).
- **Entry Point:** `index.ts` -> `App.tsx` (Currently using standard root registration via `registerRootComponent(App)`. *Note: `expo-router` is NOT currently installed; do not import `expo-router` unless explicitly asked to migrate routing*).
- **Camera & Barcode:** `expo-camera` (`CameraView`, `useCameraPermissions`).
- **Local Storage:** `expo-file-system` (`File`, `Paths.document`) for persisting scanned barcodes on device (`scanned_barcodes.json`).

---

## 2. Directory Structure & Responsibilities

```text
├── App.tsx                             # Root application component & screen host
├── app.json                            # Expo config & native permissions (Android CAMERA)
├── src/
│   ├── components/
│   │   └── BarcodeScannerView.tsx      # Reusable camera + reticle + scan result UI
│   ├── hooks/
│   │   └── useBarcodeScanner.ts        # Multi-frame consensus & scan state hook
│   ├── types/
│   │   └── barcode.ts                  # Shared TypeScript interfaces (ScannedBarcode, etc.)
│   └── utils/
│       ├── barcodeStorage.ts           # Local device file persistence & new/old barcode lookup
│       └── barcodeValidator.ts         # Pure GS1 Modulo-10 checksum & format validators
```

---

## 3. Core Invariants (DO NOT BREAK)

1. **Barcode Precision & Anti-Misread Pipeline:**
   - Raw single-frame reads from `CameraView.onBarcodeScanned` are prone to motion-blur and autofocus misreads.
   - **Never** wire `CameraView.onBarcodeScanned` directly to state without going through `useBarcodeScanner` (`src/hooks/useBarcodeScanner.ts`) and `isBarcodeValid` (`src/utils/barcodeValidator.ts`).
   - **Checksum Enforcement:** `ean13`, `ean8`, and `upc_a` barcodes must pass GS1 Modulo-10 check digit verification (`isValidGtinChecksum`).
   - **Multi-Frame Consensus:** A barcode must be read identically across `DEFAULT_REQUIRED_CONSECUTIVE_READS` (3) consecutive frames within `DEFAULT_CONSENSUS_TIMEOUT_MS` (1200ms) before firing `onScanned`.
   - **Supported Symbologies:** Keep `SUPPORTED_BARCODE_TYPES` limited to reliable formats (`ean13`, `ean8`, `upc_a`, `upc_e`, `code128`, `qr`) unless specifically requested otherwise.

2. **React Native 0.88+ StyleSheet Compatibility:**
   - Use `...StyleSheet.absoluteFill` (NOT `StyleSheet.absoluteFillObject`, which is removed from RN 0.88 type definitions).

3. **Continuous Native Generation (CNG):**
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
