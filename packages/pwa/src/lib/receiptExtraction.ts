/**
 * Extracted data from a receipt scan
 */
export interface ExtractedReceiptData {
  /** Merchant/store name */
  merchant: string | null;
  /** Total amount in the receipt's currency */
  total: number | null;
  /** Date as a string (needs parsing based on locale) */
  date: string | null;
  /** Raw OCR text for debugging */
  rawText: string;
}

/**
 * Parses a date string from various common receipt formats.
 * Attempts to handle both US (MM/DD/YYYY) and European (DD/MM/YYYY) formats.
 */
export function parseReceiptDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const trimmed = dateStr.trim().toUpperCase();

  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try numeric formats (MM/DD/YYYY or DD/MM/YYYY)
  const numericMatch = trimmed.match(
    /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/,
  );
  if (numericMatch) {
    const [, first, second, yearStr] = numericMatch;
    const year =
      yearStr.length === 2 ? 2000 + parseInt(yearStr) : parseInt(yearStr);

    // Try to determine format based on values
    const firstNum = parseInt(first);
    const secondNum = parseInt(second);

    // If first > 12, it must be day (DD/MM/YYYY)
    if (firstNum > 12) {
      const date = new Date(year, secondNum - 1, firstNum);
      if (!isNaN(date.getTime())) return date;
    }
    // If second > 12, it must be day (MM/DD/YYYY)
    else if (secondNum > 12) {
      const date = new Date(year, firstNum - 1, secondNum);
      if (!isNaN(date.getTime())) return date;
    }
    // Ambiguous - default to user's locale preference
    // For now, assume MM/DD/YYYY (US format) as receipts often use local format
    else {
      const date = new Date(year, firstNum - 1, secondNum);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Try month name formats
  const monthNames: Record<string, number> = {
    JAN: 0,
    JANUARY: 0,
    FEB: 1,
    FEBRUARY: 1,
    MAR: 2,
    MARCH: 2,
    APR: 3,
    APRIL: 3,
    MAY: 4,
    JUN: 5,
    JUNE: 5,
    JUL: 6,
    JULY: 6,
    AUG: 7,
    AUGUST: 7,
    SEP: 8,
    SEPT: 8,
    SEPTEMBER: 8,
    OCT: 9,
    OCTOBER: 9,
    NOV: 10,
    NOVEMBER: 10,
    DEC: 11,
    DECEMBER: 11,
  };

  // "Month DD, YYYY" or "Month DD YYYY"
  const monthFirstMatch = trimmed.match(/^([A-Z]+)\s+(\d{1,2}),?\s+(\d{2,4})/);
  if (monthFirstMatch) {
    const [, monthStr, day, yearStr] = monthFirstMatch;
    const month = monthNames[monthStr];
    if (month !== undefined) {
      const year =
        yearStr.length === 2 ? 2000 + parseInt(yearStr) : parseInt(yearStr);
      const date = new Date(year, month, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // "DD Month YYYY"
  const dayFirstMatch = trimmed.match(/^(\d{1,2})\s+([A-Z]+),?\s+(\d{2,4})/);
  if (dayFirstMatch) {
    const [, day, monthStr, yearStr] = dayFirstMatch;
    const month = monthNames[monthStr];
    if (month !== undefined) {
      const year =
        yearStr.length === 2 ? 2000 + parseInt(yearStr) : parseInt(yearStr);
      const date = new Date(year, month, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }
  }

  return null;
}

/**
 * Formats extracted data for display
 */
export function formatExtractedData(data: ExtractedReceiptData): {
  merchant: string;
  total: string;
  date: string;
  hasData: boolean;
} {
  const merchant = data.merchant ?? "";
  const total = data.total !== null ? data.total.toFixed(2) : "";
  const date = data.date ?? "";
  const hasData = !!(data.merchant || data.total !== null || data.date);

  return { merchant, total, date, hasData };
}
