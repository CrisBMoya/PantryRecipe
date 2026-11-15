import { useState, useRef, useCallback } from 'react';
import { BarcodeScanningResult } from 'expo-camera';
import { BarcodeScannerConfig, ScannedBarcode } from '../types/barcode';
import { isBarcodeValid } from '../utils/barcodeValidator';
import { checkAndSaveBarcode } from '../utils/barcodeStorage';

export const DEFAULT_REQUIRED_CONSECUTIVE_READS = 3;
export const DEFAULT_CONSENSUS_TIMEOUT_MS = 1200;

interface CandidateState {
  data: string;
  type: string;
  count: number;
  lastTimestamp: number;
}

export interface UseBarcodeScannerReturn {
  isScanning: boolean;
  scannedResult: ScannedBarcode | null;
  verifyingProgress: number;
  requiredReads: number;
  handleBarcodeScanned: (result: BarcodeScanningResult) => void;
  startScanning: () => void;
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

  const [isScanning, setIsScanning] = useState<boolean>(false);
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

  const startScanning = useCallback(() => {
    candidateRef.current = { data: '', type: '', count: 0, lastTimestamp: 0 };
    setVerifyingProgress(0);
    setScannedResult(null);
    setIsScanning(true);
  }, []);

  const resetScanner = useCallback(() => {
    candidateRef.current = { data: '', type: '', count: 0, lastTimestamp: 0 };
    setVerifyingProgress(0);
    setScannedResult(null);
    setIsScanning(false);
  }, []);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!isScanning || scannedResult) return;

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
        const baseBarcode: ScannedBarcode = {
          type: barcodeType,
          data: rawData,
          scannedAt: now,
        };
        const { status } = checkAndSaveBarcode(baseBarcode);
        const verifiedBarcode: ScannedBarcode = {
          ...baseBarcode,
          status,
        };
        console.log(
          `[BarcodeScanner] Code: ${verifiedBarcode.data} | Status: ${status.toUpperCase()} (${
            status === 'new' ? 'New code saved to file' : 'Old code already in file'
          })`
        );
        setIsScanning(false);
        setVerifyingProgress(requiredReads);
        setScannedResult(verifiedBarcode);
        onScanned?.(verifiedBarcode);
      } else {
        setVerifyingProgress(current.count);
      }
    },
    [isScanning, scannedResult, consensusTimeoutMs, requiredReads, onScanned]
  );

  return {
    isScanning,
    scannedResult,
    verifyingProgress,
    requiredReads,
    handleBarcodeScanned,
    startScanning,
    resetScanner,
  };
}
