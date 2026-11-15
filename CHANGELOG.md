# Changelog

All notable changes to this project are documented in this file.

## [0.1.0] - 2026-11-15

### Added
- **Expo TypeScript Scaffold:** Initialized Android-first mobile app using Expo SDK 58, React Native 0.88, and `expo-camera`.
- **Barcode Scanner Component (`src/components/BarcodeScannerView.tsx`):** Full-screen camera viewfinder with permission handling, status reticle, and scanned result card.
- **High-Precision Scan Pipeline:**
  - **Multi-Frame Consensus (`src/hooks/useBarcodeScanner.ts`):** Requires 3 consecutive identical reads within 1200ms to prevent motion-blur and autofocus misreads.
  - **GS1 Modulo-10 Checksum Validator (`src/utils/barcodeValidator.ts`):** Validates check digits for `ean13`, `ean8`, and `upc_a` barcodes and restricts scanning to reliable formats (`ean13`, `ean8`, `upc_a`, `upc_e`, `code128`, `qr`).
- **Multi-LLM Handoff Documentation:** Added `AGENTS.md`, `GEMINI.md`, and updated `README.md` with project structure and core scanner invariants.
