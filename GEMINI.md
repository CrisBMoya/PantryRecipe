# PantryRecipe — Project Instructions

See [`./AGENTS.md`](./AGENTS.md) for the complete architecture, directory structure, barcode precision invariants, and development commands.

## Quick Rules for Agents
- **Entry Point:** `App.tsx` (do not assume `expo-router` is installed unless added to `package.json`).
- **Barcode Scanning:** Always use `BarcodeScannerView` (`src/components/BarcodeScannerView.tsx`) or `useBarcodeScanner` (`src/hooks/useBarcodeScanner.ts`). Never bypass the 3-frame consensus or GS1 Modulo-10 checksum validation in `src/utils/barcodeValidator.ts`.
- **TypeScript Verification:** Always run `npx tsc --noEmit` after code changes. Use `StyleSheet.absoluteFill` instead of `StyleSheet.absoluteFillObject` (React Native 0.88 types).
- **Dependencies:** Install packages exclusively with `npx expo install <package>`.
- **Backend Server (`server/`):** Managed with `uv` using the virtual environment at `C:\Users\Tobal\virtual_environments\server\.venv\`. Built with LangChain, LangGraph, and Gemini (`langchain-google-genai`), loading `GOOGLE_API_KEY` from `server/.env`.
