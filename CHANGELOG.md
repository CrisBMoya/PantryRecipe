# Changelog

All notable changes to this project are documented in this file.

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
