import { BarcodeType } from 'expo-camera';

export interface ScannedBarcode {
  type: BarcodeType | string;
  data: string;
  scannedAt: number;
}

export interface BarcodeScannerConfig {
  /**
   * Number of identical consecutive frames required to confirm a scan.
   * Defaults to 3.
   */
  requiredConsecutiveReads?: number;
  /**
   * Maximum time window (in ms) allowed between consecutive reads.
   * Defaults to 1200ms.
   */
  consensusTimeoutMs?: number;
  /**
   * Barcode types to scan. Defaults to SUPPORTED_BARCODE_TYPES.
   */
  barcodeTypes?: BarcodeType[];
}
