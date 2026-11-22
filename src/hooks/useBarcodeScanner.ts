import { useState, useRef, useCallback, useEffect } from 'react';
import { BarcodeScanningResult } from 'expo-camera';
import {
  BarcodeScannerConfig,
  ManualProductInput,
  ProductInfo,
  ScannedBarcode,
  ScannedBarcodesSyncResponse,
  StoredBarcodeEntry,
} from '../types/barcode';
import { isBarcodeValid } from '../utils/barcodeValidator';
import {
  addManualProduct,
  checkAndSaveBarcode,
  deleteStoredBarcode,
  loadStoredBarcodes,
  saveFrontProductPhoto,
  saveProductInfoForBarcode,
} from '../utils/barcodeStorage';
import {
  DEFAULT_SERVER_PORT,
  resolveServerBaseUrl,
  sendScannedBarcodesToServer,
  uploadProductPhotoBinary,
} from '../utils/productApi';

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
  isUploadingPhoto: boolean;
  uploadError: string | null;
  isSendingBarcodes: boolean;
  sendBarcodesError: string | null;
  sendBarcodesSuccessMessage: string | null;
  recipeSuggestion: string | null;
  storedBarcodes: StoredBarcodeEntry[];
  handleBarcodeScanned: (result: BarcodeScanningResult) => void;
  startScanning: () => void;
  resetScanner: () => void;
  attachFrontPhoto: (sourcePhotoUri: string) => string | null;
  uploadFrontPhoto: (photoUriOverride?: string) => Promise<ProductInfo | null>;
  sendStoredBarcodesToServer: (
    selectedEntries?: StoredBarcodeEntry[]
  ) => Promise<ScannedBarcodesSyncResponse | null>;
  clearRecipeSuggestion: () => void;
  refreshStoredBarcodes: () => StoredBarcodeEntry[];
  removeStoredBarcode: (barcodeData: string) => StoredBarcodeEntry[];
  createManualProduct: (input: ManualProductInput) => StoredBarcodeEntry;
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
  const serverBaseUrl = config?.serverBaseUrl;

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<ScannedBarcode | null>(
    null
  );
  const [verifyingProgress, setVerifyingProgress] = useState<number>(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSendingBarcodes, setIsSendingBarcodes] = useState<boolean>(false);
  const [sendBarcodesError, setSendBarcodesError] = useState<string | null>(
    null
  );
  const [sendBarcodesSuccessMessage, setSendBarcodesSuccessMessage] =
    useState<string | null>(null);
  const [recipeSuggestion, setRecipeSuggestion] = useState<string | null>(null);
  const [storedBarcodes, setStoredBarcodes] = useState<StoredBarcodeEntry[]>(
    () => loadStoredBarcodes()
  );

  const candidateRef = useRef<CandidateState>({
    data: '',
    type: '',
    count: 0,
    lastTimestamp: 0,
  });

  const refreshStoredBarcodes = useCallback((): StoredBarcodeEntry[] => {
    const entries = loadStoredBarcodes();
    setStoredBarcodes(entries);
    return entries;
  }, []);

  const removeStoredBarcode = useCallback(
    (barcodeData: string): StoredBarcodeEntry[] => {
      const normalized = barcodeData.trim();
      const remaining = deleteStoredBarcode(normalized);
      setStoredBarcodes(remaining);
      setScannedResult((prev) =>
        prev && prev.data === normalized ? null : prev
      );
      return remaining;
    },
    []
  );

  const createManualProduct = useCallback(
    (input: ManualProductInput): StoredBarcodeEntry => {
      const { entry, entries } = addManualProduct(input);
      setStoredBarcodes(entries);
      console.log(
        `[BarcodeScanner] Added manual product (${entry.data}): ${entry.brand} - ${entry.product_name}`
      );
      return entry;
    },
    []
  );

  useEffect(() => {
    const resolvedUrl = resolveServerBaseUrl(serverBaseUrl);
    const parsedUrl = new URL(resolvedUrl);
    const port =
      parsedUrl.port ||
      (parsedUrl.protocol === 'https:' ? '443' : String(DEFAULT_SERVER_PORT));
    console.log(
      `[BarcodeScanner] Configured backend server URL: ${resolvedUrl} (Port: ${port})`
    );
  }, [serverBaseUrl]);

  const startScanning = useCallback(() => {
    candidateRef.current = { data: '', type: '', count: 0, lastTimestamp: 0 };
    setVerifyingProgress(0);
    setScannedResult(null);
    setUploadError(null);
    setIsUploadingPhoto(false);
    setIsScanning(true);
  }, []);

  const resetScanner = useCallback(() => {
    candidateRef.current = { data: '', type: '', count: 0, lastTimestamp: 0 };
    setVerifyingProgress(0);
    setScannedResult(null);
    setUploadError(null);
    setIsUploadingPhoto(false);
    setIsScanning(false);
  }, []);

  const uploadFrontPhoto = useCallback(
    async (photoUriOverride?: string): Promise<ProductInfo | null> => {
      const targetUri = photoUriOverride ?? scannedResult?.frontPhotoUri;
      const targetBarcodeData = scannedResult?.data;
      if (!targetUri || !targetBarcodeData) {
        return null;
      }

      setIsUploadingPhoto(true);
      setUploadError(null);

      try {
        const productInfo = await uploadProductPhotoBinary(
          targetUri,
          targetBarcodeData,
          serverBaseUrl
        );
        saveProductInfoForBarcode(targetBarcodeData, productInfo);
        setStoredBarcodes(loadStoredBarcodes());

        setScannedResult((prev) => {
          if (!prev || prev.data !== targetBarcodeData) {
            return prev;
          }
          const updated: ScannedBarcode = {
            ...prev,
            frontPhotoUri: targetUri,
            product_name: productInfo.product_name,
            brand: productInfo.brand,
            search_result: productInfo.search_result,
            productInfo,
          };
          onScanned?.(updated);
          return updated;
        });

        console.log(
          `[BarcodeScanner] Extracted product info for ${targetBarcodeData}: ${productInfo.brand} - ${productInfo.product_name}`
        );
        return productInfo;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to send product photo to server.';
        console.warn('Failed to upload front product photo to server:', error);
        setUploadError(message);
        return null;
      } finally {
        setIsUploadingPhoto(false);
      }
    },
    [scannedResult, serverBaseUrl, onScanned]
  );

  const attachFrontPhoto = useCallback(
    (sourcePhotoUri: string): string | null => {
      if (!scannedResult) return null;

      try {
        const { savedPhotoUri } = saveFrontProductPhoto(
          scannedResult.data,
          sourcePhotoUri
        );
        setStoredBarcodes(loadStoredBarcodes());
        const updatedBarcode: ScannedBarcode = {
          ...scannedResult,
          frontPhotoUri: savedPhotoUri,
          product_name: undefined,
          brand: undefined,
          search_result: undefined,
          productInfo: undefined,
        };
        console.log(
          `[BarcodeScanner] Saved front product photo for ${scannedResult.data}: ${savedPhotoUri}`
        );
        setScannedResult(updatedBarcode);
        onScanned?.(updatedBarcode);
        void uploadFrontPhoto(savedPhotoUri);
        return savedPhotoUri;
      } catch (error) {
        console.warn('Failed to save front product photo:', error);
        return null;
      }
    },
    [scannedResult, onScanned, uploadFrontPhoto]
  );

  const sendStoredBarcodesToServer = useCallback(
    async (
      selectedEntries?: StoredBarcodeEntry[]
    ): Promise<ScannedBarcodesSyncResponse | null> => {
      setIsSendingBarcodes(true);
      setSendBarcodesError(null);
      setSendBarcodesSuccessMessage(null);

      try {
        const latestEntries = loadStoredBarcodes();
        setStoredBarcodes(latestEntries);
        const entriesToSend = selectedEntries ?? latestEntries;
        const response = await sendScannedBarcodesToServer(
          entriesToSend,
          serverBaseUrl
        );
        const isSubset =
          selectedEntries !== undefined &&
          selectedEntries.length !== latestEntries.length;
        const message = isSubset
          ? `Sent ${response.received_count} selected ${
              response.received_count === 1 ? 'item' : 'items'
            } from scanned_barcodes.json to server.`
          : `Sent ${response.received_count} ${
              response.received_count === 1 ? 'item' : 'items'
            } from scanned_barcodes.json to server.`;
        setSendBarcodesSuccessMessage(message);
        console.log(`[BarcodeScanner] ${message}`);

        if (response.recipe_suggestion) {
          setRecipeSuggestion(response.recipe_suggestion);
          console.log(
            `[BarcodeScanner] Suggested Cooking Recipe:\n${response.recipe_suggestion}`
          );
        } else {
          setRecipeSuggestion(null);
        }

        return response;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to send scanned_barcodes.json to server.';
        console.warn('Failed to send scanned_barcodes.json to server:', error);
        setSendBarcodesError(message);
        return null;
      } finally {
        setIsSendingBarcodes(false);
      }
    },
    [serverBaseUrl]
  );

  const clearRecipeSuggestion = useCallback(() => {
    setRecipeSuggestion(null);
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
        const { status, entry } = checkAndSaveBarcode(baseBarcode);
        setStoredBarcodes(loadStoredBarcodes());
        const verifiedBarcode: ScannedBarcode = {
          ...baseBarcode,
          status,
          frontPhotoUri: entry.frontPhotoUri,
          product_name: entry.product_name ?? entry.productInfo?.product_name,
          brand: entry.brand ?? entry.productInfo?.brand,
          search_result:
            entry.search_result ?? entry.productInfo?.search_result,
          productInfo: entry.productInfo,
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
    isUploadingPhoto,
    uploadError,
    isSendingBarcodes,
    sendBarcodesError,
    sendBarcodesSuccessMessage,
    recipeSuggestion,
    storedBarcodes,
    handleBarcodeScanned,
    startScanning,
    resetScanner,
    attachFrontPhoto,
    uploadFrontPhoto,
    sendStoredBarcodesToServer,
    clearRecipeSuggestion,
    refreshStoredBarcodes,
    removeStoredBarcode,
    createManualProduct,
  };
}
