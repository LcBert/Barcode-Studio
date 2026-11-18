import { GS1AIOption } from '../models/gs1.model';

function calculateMod10CheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  // GS1 Mod-10 algorithm: alternating weights 3 and 1 from right to left
  const reversed = digitsWithoutCheck.split('').reverse();
  for (let i = 0; i < reversed.length; i++) {
    const n = parseInt(reversed[i], 10);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  return (10 - (sum % 10)) % 10;
}

function randomDigits(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

function randomAlphaNumeric(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomDateYYMMDD(futureOnly = true): string {
  const now = new Date();
  const yearOffset = futureOnly ? Math.floor(Math.random() * 3) + 1 : -Math.floor(Math.random() * 2);
  const targetYear = now.getFullYear() + yearOffset;
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;

  const yy = targetYear.toString().slice(-2);
  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

export function validateField(
  ai: string,
  value: string,
  spec?: GS1AIOption
): { isValid: boolean; message?: string } {
  const clean = (value || '').trim();
  if (!clean) {
    return { isValid: false, message: 'Valore richiesto' };
  }
  if (!ai) {
    if (clean.length > 80) {
      return { isValid: false, message: 'Superato limite massimo di 80 caratteri' };
    }
    if (!/^[\x20-\x7E]+$/.test(clean)) {
      return { isValid: false, message: 'Caratteri non validi (solo caratteri ASCII standard)' };
    }
    return { isValid: true };
  }
  if (spec?.fixed_length && clean.length !== spec.fixed_length) {
    return {
      isValid: false,
      message: `Richiesti esattamente ${spec.fixed_length} caratteri (${clean.length}/${spec.fixed_length})`,
    };
  }
  if (spec?.max_length && clean.length > spec.max_length) {
    return {
      isValid: false,
      message: `Superato limite massimo di ${spec.max_length} caratteri`,
    };
  }
  if (spec?.regex) {
    try {
      const reg = new RegExp(spec.regex);
      if (!reg.test(clean)) {
        return { isValid: false, message: `Formato non valido (${spec.placeholder || spec.type})` };
      }
    } catch {
      // fallback
    }
  }
  return { isValid: true };
}

export function generateRandomGS1Value(ai: string, spec?: GS1AIOption): string {
  switch (ai) {
    case '':
      return `CODE-${randomAlphaNumeric(8)}`;
    case '01':
    case '02': {
      // 14-digit GTIN with valid Mod-10 check digit
      const prefix = randomDigits(13);
      const check = calculateMod10CheckDigit(prefix);
      return `${prefix}${check}`;
    }
    case '00': {
      // 18-digit SSCC with valid Mod-10 check digit
      const prefix = randomDigits(17);
      const check = calculateMod10CheckDigit(prefix);
      return `${prefix}${check}`;
    }
    case '10': {
      // Batch / Lot: e.g. BATCH-7X92
      return `LOT-${randomAlphaNumeric(6)}`;
    }
    case '11': // Production Date (past or today)
      return randomDateYYMMDD(false);
    case '12': // Due Date
    case '13': // Packaging Date
    case '15': // Best Before Date
    case '17': // Expiration Date (future)
      return randomDateYYMMDD(true);
    case '20': // Internal variant: 2 digits
      return Math.floor(Math.random() * 90 + 10).toString();
    case '21': // Serial Number
      return `SN${randomAlphaNumeric(8)}`;
    case '240': // Additional Product Identification
      return `PRD-${randomAlphaNumeric(8)}`;
    case '30': // Variable count / quantity
    case '37': // Count of trade items
      return Math.floor(Math.random() * 950 + 10).toString();
    case '3100':
    case '3102':
    case '3103': {
      // Net weight (6 numeric digits)
      const grams = Math.floor(Math.random() * 90000 + 1000);
      return grams.toString().padStart(6, '0');
    }
    case '400': // Customer PO
      return `PO-${randomAlphaNumeric(6)}`;
    case '420': // Postal code (5 digits)
      return Math.floor(Math.random() * 90000 + 10000).toString();
    case '421': // ISO Country (3 digits) + Postal code
      return `380${Math.floor(Math.random() * 90000 + 10000)}`;
    case '90':
    case '91':
      return `INT-${randomAlphaNumeric(6)}`;
    default: {
      if (spec?.fixed_length) {
        return spec.type === 'numeric'
          ? randomDigits(spec.fixed_length)
          : randomAlphaNumeric(spec.fixed_length);
      }
      if (spec?.type === 'date') {
        return randomDateYYMMDD(true);
      }
      if (spec?.type === 'numeric') {
        const len = Math.min(spec.max_length || 6, 6);
        return randomDigits(len);
      }
      const len = Math.min(spec?.max_length || 8, 8);
      return randomAlphaNumeric(len);
    }
  }
}
