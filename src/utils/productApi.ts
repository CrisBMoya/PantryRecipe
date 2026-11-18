import { Platform } from 'react-native';
import { fetch } from 'expo/fetch';
import { File as FsFile } from 'expo-file-system';
import { ProductInfo } from '../types/barcode';

export const DEFAULT_SERVER_PORT = 8000;
export const ANALYZE_BYTES_PATH = '/products/analyze-bytes';

function inferMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function getMetroDebuggerHost(): string | null {
  try {
    // Attempt to resolve the dev machine LAN host from React Native SourceCode scriptURL when running in Expo Go / Dev Client
    const globalWithNative = globalThis as Record<string, unknown>;
    const turboProxy = globalWithNative.__turboModuleProxy as
      | ((name: string) => { getConstants?: () => { scriptURL?: string } } | null)
      | undefined;
    const scriptURL = turboProxy?.('SourceCode')?.getConstants?.()?.scriptURL;
    if (typeof scriptURL === 'string' && scriptURL.startsWith('http')) {
      const url = new URL(scriptURL);
      if (url.hostname && url.hostname !== 'localhost') {
        return url.hostname;
      }
    }
  } catch {
    // Ignore resolution errors and fall back to platform defaults
  }
  return null;
}

/**
 * Resolves the base URL for the PantryRecipe FastAPI server.
 * Priority:
 * 1. Explicit `overrideBaseUrl` parameter
 * 2. `EXPO_PUBLIC_API_URL` environment variable
 * 3. Metro packager LAN host on port 8000 (useful on physical Android devices)
 * 4. Android emulator loopback (`http://10.0.2.2:8000`) or `http://localhost:8000`
 */
export function resolveServerBaseUrl(overrideBaseUrl?: string): string {
  const explicit =
    overrideBaseUrl?.trim() || process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const metroHost = getMetroDebuggerHost();
  if (metroHost) {
    return `http://${metroHost}:${DEFAULT_SERVER_PORT}`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_SERVER_PORT}`;
  }

  return `http://localhost:${DEFAULT_SERVER_PORT}`;
}

/**
 * Reads a local product photograph as binary data and sends it via HTTP POST
 * to `POST /products/analyze-bytes` on the FastAPI backend along with the scanned barcode.
 */
export async function uploadProductPhotoBinary(
  photoUri: string,
  barcode: string,
  serverBaseUrl?: string
): Promise<ProductInfo> {
  const file = new FsFile(photoUri);
  if (!file.exists) {
    throw new Error(`Product photo file does not exist at ${photoUri}`);
  }

  const mimeType = inferMimeType(photoUri);
  const imageBytes = await file.bytes();
  if (!imageBytes || imageBytes.byteLength === 0) {
    throw new Error('Captured product photo file is empty.');
  }

  const normalizedBarcode = barcode.trim();
  const baseUrl = resolveServerBaseUrl(serverBaseUrl);
  const endpoint = `${baseUrl}${ANALYZE_BYTES_PATH}?barcode=${encodeURIComponent(normalizedBarcode)}`;
  const parsedUrl = new URL(baseUrl);
  const port =
    parsedUrl.port ||
    (parsedUrl.protocol === 'https:' ? '443' : String(DEFAULT_SERVER_PORT));

  console.log(
    `[ProductAPI] Sending binary image (${imageBytes.byteLength} bytes, ${mimeType}) + barcode (${normalizedBarcode}) -> Server: ${baseUrl} (Port: ${port}) | Endpoint: ${endpoint}`
  );

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      Accept: 'application/json',
      'X-Barcode': normalizedBarcode,
    },
    body: imageBytes,
  });

  if (!response.ok) {
    let errorDetail = `Server responded with HTTP ${response.status}`;
    try {
      const errorJson = (await response.json()) as { detail?: string };
      if (errorJson?.detail) {
        errorDetail = errorJson.detail;
      }
    } catch {
      // Ignore non-JSON error body
    }
    throw new Error(errorDetail);
  }

  const data = (await response.json()) as Partial<ProductInfo>;
  if (
    typeof data?.product_name !== 'string' ||
    typeof data?.brand !== 'string'
  ) {
    throw new Error('Invalid product info response from server.');
  }

  return {
    product_name: data.product_name,
    brand: data.brand,
  };
}
