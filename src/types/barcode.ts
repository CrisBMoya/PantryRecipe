import { BarcodeType } from 'expo-camera';

export type BarcodeOriginStatus = 'new' | 'old';

export interface ScannedBarcode {
  type: BarcodeType | string;
  data: string;
  scannedAt: number;
  status?: BarcodeOriginStatus;
  frontPhotoUri?: string;
}

export interface StoredBarcodeEntry {
  data: string;
  type: string;
  firstScannedAt: number;
  lastScannedAt: number;
  scanCount: number;
  frontPhotoUri?: string;
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
