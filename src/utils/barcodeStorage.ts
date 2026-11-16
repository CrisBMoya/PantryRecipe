import { Directory, File, Paths } from 'expo-file-system';
import {
  BarcodeOriginStatus,
  ProductInfo,
  ScannedBarcode,
  StoredBarcodeEntry,
} from '../types/barcode';

export const SCANNED_CODES_FILENAME = 'scanned_barcodes.json';
export const PRODUCT_PHOTOS_DIR_NAME = 'product_photos';

function getStorageFile(): File {
  return new File(Paths.document, SCANNED_CODES_FILENAME);
}

function getPhotosDirectory(): Directory {
  return new Directory(Paths.document, PRODUCT_PHOTOS_DIR_NAME);
}

function sanitizeBarcodeFilename(barcodeData: string): string {
  return barcodeData.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown';
}

function writeStoredBarcodes(entries: StoredBarcodeEntry[]): string {
  const file = getStorageFile();
  try {
    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
    }
    file.write(JSON.stringify(entries, null, 2));
  } catch (error) {
    console.warn('Failed to write barcode to local storage file:', error);
  }
  return file.uri;
}

function normalizeStoredEntry(item: StoredBarcodeEntry): StoredBarcodeEntry {
  const productName =
    typeof item.product_name === 'string' && item.product_name.trim()
      ? item.product_name.trim()
      : typeof item.productInfo?.product_name === 'string' &&
          item.productInfo.product_name.trim()
        ? item.productInfo.product_name.trim()
        : undefined;

  const brand =
    typeof item.brand === 'string' && item.brand.trim()
      ? item.brand.trim()
      : typeof item.productInfo?.brand === 'string' &&
          item.productInfo.brand.trim()
        ? item.productInfo.brand.trim()
        : undefined;

  const productInfo: ProductInfo | undefined =
    productName !== undefined || brand !== undefined
      ? {
          product_name: productName ?? '',
          brand: brand ?? '',
        }
      : undefined;

  return {
    ...item,
    ...(productName !== undefined ? { product_name: productName } : {}),
    ...(brand !== undefined ? { brand } : {}),
    ...(productInfo ? { productInfo } : {}),
  };
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

    return parsed
      .filter(
        (item): item is StoredBarcodeEntry =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as StoredBarcodeEntry).data === 'string'
      )
      .map(normalizeStoredEntry);
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

  const fileUri = writeStoredBarcodes(entries);

  return {
    status,
    entry: targetEntry,
    totalSaved: entries.length,
    fileUri,
  };
}

/**
 * Copies a captured front product photo from temporary camera cache into
 * persistent device storage (`Paths.document/product_photos`) and updates
 * the corresponding entry in `scanned_barcodes.json` so it can later be
 * uploaded via API.
 */
export function saveFrontProductPhoto(
  barcodeData: string,
  sourcePhotoUri: string
): {
  savedPhotoUri: string;
  entry: StoredBarcodeEntry | null;
} {
  const normalizedData = barcodeData.trim();
  const photosDir = getPhotosDirectory();

  if (!photosDir.exists) {
    photosDir.create({ intermediates: true, idempotent: true });
  }

  const safeCode = sanitizeBarcodeFilename(normalizedData);
  const filename = `${safeCode}_front_${Date.now()}.jpg`;
  const destinationFile = new File(photosDir, filename);

  const sourceFile = new File(sourcePhotoUri);
  if (destinationFile.exists) {
    destinationFile.delete();
  }
  sourceFile.copy(destinationFile);

  const savedPhotoUri = destinationFile.uri;
  const entries = loadStoredBarcodes();
  const existingIndex = entries.findIndex(
    (entry) => entry.data === normalizedData
  );

  let updatedEntry: StoredBarcodeEntry | null = null;
  if (existingIndex !== -1) {
    updatedEntry = {
      ...entries[existingIndex],
      frontPhotoUri: savedPhotoUri,
    };
    entries[existingIndex] = updatedEntry;
    writeStoredBarcodes(entries);
  }

  return {
    savedPhotoUri,
    entry: updatedEntry,
  };
}

/**
 * Updates the stored barcode entry with extracted ProductInfo (product_name and brand)
 * returned by the backend server.
 */
export function saveProductInfoForBarcode(
  barcodeData: string,
  productInfo: ProductInfo
): StoredBarcodeEntry | null {
  const normalizedData = barcodeData.trim();
  const entries = loadStoredBarcodes();
  const existingIndex = entries.findIndex(
    (entry) => entry.data === normalizedData
  );

  if (existingIndex === -1) {
    return null;
  }

  const normalizedProductInfo: ProductInfo = {
    product_name: productInfo.product_name.trim(),
    brand: productInfo.brand.trim(),
  };

  const updatedEntry: StoredBarcodeEntry = {
    ...entries[existingIndex],
    product_name: normalizedProductInfo.product_name,
    brand: normalizedProductInfo.brand,
    productInfo: normalizedProductInfo,
  };
  entries[existingIndex] = updatedEntry;
  writeStoredBarcodes(entries);

  return updatedEntry;
}

/**
 * Deletes a stored product/barcode entry from `scanned_barcodes.json` and
 * cleans up its local front photo file if present.
 * Returns the remaining stored barcode entries.
 */
export function deleteStoredBarcode(barcodeData: string): StoredBarcodeEntry[] {
  const normalizedData = barcodeData.trim();
  const entries = loadStoredBarcodes();
  const targetEntry = entries.find((entry) => entry.data === normalizedData);

  if (targetEntry?.frontPhotoUri) {
    try {
      const photoFile = new File(targetEntry.frontPhotoUri);
      if (photoFile.exists) {
        photoFile.delete();
      }
    } catch (error) {
      console.warn('Failed to delete associated product photo:', error);
    }
  }

  const remainingEntries = entries.filter(
    (entry) => entry.data !== normalizedData
  );
  writeStoredBarcodes(remainingEntries);
  return remainingEntries;
}

