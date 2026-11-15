import { useState, useRef, useCallback } from 'react';
import { BarcodeScanningResult } from 'expo-camera';
import { BarcodeScannerConfig, ScannedBarcode } from '../types/barcode';
import { isBarcodeValid } from '../utils/barcodeValidator';

export const DEFAULT_REQUIRED_CONSECUTIVE_READS = 3;
export const DEFAULT_CONSENSUS_TIMEOUT_MS = 1200;

interface CandidateState {
  data: string;
  type: string;
  count: number;
  lastTimestamp: number;
}

export interface UseBarcodeScannerReturn {
  scannedResult: ScannedBarcode | null;
  verifyingProgress: number;
  requiredReads: number;
  handleBarcodeScanned: (result: BarcodeScanningResult) => void;
  resetScanner: () => void;
}

/**
 * Manages barcode scanning state with multi-frame consensus and GTIN checksum validation
 * to prevent motion-blur or autofocus misreads.
 */
export function useBarcodeScanner(
  config?: BarcodeScannerConfig,
  onScanned?: (barcode: ScannedBarcode) => void
): UseBarcodeScannerReturn {
  const requiredReads =
    config?.requiredConsecutiveReads ?? DEFAULT_REQUIRED_CONSECUTIVE_READS;
  const consensusTimeoutMs =
    config?.consensusTimeoutMs ?? DEFAULT_CONSENSUS_TIMEOUT_MS;

  const [scannedResult, setScannedResult] = useState<ScannedBarcode | null>(
    null
  );
  const [verifyingProgress, setVerifyingProgress] = useState<number>(0);

  const candidateRef = useRef<CandidateState>({
    data: '',
    type: '',
    count: 0,
    lastTimestamp: 0,
  });

  const resetScanner = useCallback(() => {
    candidateRef.current = { data: '', type: '', count: 0, lastTimestamp: 0 };
    setVerifyingProgress(0);
    setScannedResult(null);
  }, []);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scannedResult) return;

      const rawData = result.data?.trim() ?? '';
      const barcodeType = result.type;

      // 1. Reject corrupted reads that fail checksum or format validation
      if (!isBarcodeValid(barcodeType, rawData)) {
        return;
      }

      const now = Date.now();
      const current = candidateRef.current;

      // 2. Require consecutive matching reads within consensusTimeoutMs
      if (
        current.data === rawData &&
        current.type === barcodeType &&
        now - current.lastTimestamp <= consensusTimeoutMs
      ) {
        current.count += 1;
        current.lastTimestamp = now;
      } else {
        current.data = rawData;
        current.type = barcodeType;
        current.count = 1;
        current.lastTimestamp = now;
      }

      if (current.count >= requiredReads) {
        const verifiedBarcode: ScannedBarcode = {
          type: barcodeType,
          data: rawData,
          scannedAt: now,
        };
        setVerifyingProgress(requiredReads);
        setScannedResult(verifiedBarcode);
        onScanned?.(verifiedBarcode);
      } else {
        setVerifyingProgress(current.count);
      }
    },
    [scannedResult, consensusTimeoutMs, requiredReads, onScanned]
  );

  return {
    scannedResult,
    verifyingProgress,
    requiredReads,
    handleBarcodeScanned,
    resetScanner,
  };
}
