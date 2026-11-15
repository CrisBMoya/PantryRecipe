import { BarcodeType } from 'expo-camera';

/**
 * Default barcode types enabled for retail/pantry scanning.
 * Excludes error-prone legacy 1D formats (like codabar/itf14) that lack strong checksums.
 */
export const SUPPORTED_BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'qr',
];

const GTIN_TYPES = new Set(['ean13', 'ean8', 'upc_a']);

/**
 * Validates standard GS1 Modulo-10 check digit for EAN-8 (8), UPC-A (12), and EAN-13 (13).
 */
export function isValidGtinChecksum(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  if (code.length !== 8 && code.length !== 12 && code.length !== 13) {
    return false;
  }

  const digits = code.split('').map(Number);
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;

  let sum = 0;
  digits.reverse().forEach((digit, idx) => {
    // Positions from right (excluding check digit): 1st is multiplied by 3, 2nd by 1, etc.
    sum += digit * (idx % 2 === 0 ? 3 : 1);
  });

  const calculatedCheck = (10 - (sum % 10)) % 10;
  return calculatedCheck === checkDigit;
}

/**
 * Validates a decoded barcode string according to its symbology rules.
 */
export function isBarcodeValid(type: string, data: string): boolean {
  const trimmed = data.trim();
  if (!trimmed) return false;

  const normalizedType = type.toLowerCase();
  if (GTIN_TYPES.has(normalizedType)) {
    return isValidGtinChecksum(trimmed);
  }

  if (normalizedType === 'upc_e') {
    return /^\d{6,8}$/.test(trimmed);
  }

  return true;
}
