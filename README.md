# PantryRecipe

An Android-first mobile application built with **Expo (React Native)** and **TypeScript** for scanning pantry product barcodes with high accuracy.

## Features
- **High-Precision Barcode Scanning:**
  - **Multi-Frame Consensus:** Requires 3 consecutive identical reads within 1.2s to eliminate motion-blur and autofocus misreads.
  - **GS1 Modulo-10 Checksum Validation:** Automatically verifies check digits for `EAN-13`, `EAN-8`, and `UPC-A` retail barcodes.
  - **Curated Symbologies:** Supports 1D product barcodes (`ean13`, `ean8`, `upc_a`, `upc_e`, and `code128`); QR codes are excluded.

## Project Structure
- `App.tsx`: Root application entry screen.
- `src/components/BarcodeScannerView.tsx`: Reusable camera viewfinder, reticle status UI, and permission handler. Accepts an `onScanned(barcode: ScannedBarcode)` callback for easy integration into future screens.
- `src/hooks/useBarcodeScanner.ts`: Stateful hook managing multi-frame read consensus.
- `src/utils/barcodeValidator.ts`: Pure functions for barcode format and GS1 Modulo-10 checksum validation.
- `src/types/barcode.ts`: Shared TypeScript definitions.
- `AGENTS.md` & `GEMINI.md`: Architectural context and invariants for AI coding assistants.

## Getting Started

```bash
# Start Expo development server
npm run start

# Run on Android
npm run android

# Typecheck
npx tsc --noEmit
```
