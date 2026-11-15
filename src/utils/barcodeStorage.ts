import { File, Paths } from 'expo-file-system';
import {
  BarcodeOriginStatus,
  ScannedBarcode,
  StoredBarcodeEntry,
} from '../types/barcode';

export const SCANNED_CODES_FILENAME = 'scanned_barcodes.json';

function getStorageFile(): File {
  return new File(Paths.document, SCANNED_CODES_FILENAME);
}

/**
 * Reads all stored barcode entries from the device's local document storage file.
 * Creates an empty storage file if one does not exist yet.
 */
export function loadStoredBarcodes(): StoredBarcodeEntry[] {
  try {
    const file = getStorageFile();
    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
      file.write('[]');
      return [];
    }

    const rawContent = file.textSync().trim();
    if (!rawContent) {
      return [];
    }

    const parsed: unknown = JSON.parse(rawContent);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is StoredBarcodeEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as StoredBarcodeEntry).data === 'string'
    );
  } catch {
    return [];
  }
}

/**
 * Checks whether a scanned barcode is already present in the local file.
 * - If it already exists: marks status as 'old' and updates scan metadata.
 * - If it does not exist: saves it to the local file and marks status as 'new'.
 */
export function checkAndSaveBarcode(barcode: ScannedBarcode): {
  status: BarcodeOriginStatus;
  entry: StoredBarcodeEntry;
  totalSaved: number;
  fileUri: string;
} {
  const file = getStorageFile();
  const entries = loadStoredBarcodes();
  const normalizedData = barcode.data.trim();

  const existingIndex = entries.findIndex(
    (entry) => entry.data === normalizedData
  );

  let status: BarcodeOriginStatus;
  let targetEntry: StoredBarcodeEntry;

  if (existingIndex !== -1) {
    status = 'old';
    const existing = entries[existingIndex];
    targetEntry = {
      ...existing,
      lastScannedAt: barcode.scannedAt,
      scanCount: (existing.scanCount ?? 1) + 1,
    };
    entries[existingIndex] = targetEntry;
  } else {
    status = 'new';
    targetEntry = {
      data: normalizedData,
      type: String(barcode.type),
      firstScannedAt: barcode.scannedAt,
      lastScannedAt: barcode.scannedAt,
      scanCount: 1,
    };
    entries.push(targetEntry);
  }

  try {
    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
    }
    file.write(JSON.stringify(entries, null, 2));
  } catch (error) {
    console.warn('Failed to write barcode to local storage file:', error);
  }

  return {
    status,
    entry: targetEntry,
    totalSaved: entries.length,
    fileUri: file.uri,
  };
}
