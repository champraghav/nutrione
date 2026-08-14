/**
 * Small RFC4180-style CSV parser.
 *
 * Written by hand rather than pulled in as a dependency because the tricky
 * parts (quoted fields containing commas, escaped double quotes, CRLF, BOM)
 * are exactly what breaks on real exported files, and having it local means
 * they can be unit tested directly.
 */

export function parseCsv(input: string): string[][] {
  // Strip a UTF-8 BOM — Excel-exported files routinely carry one, and it
  // would otherwise become part of the first header name.
  const text = input.replace(/^﻿/, '');

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      // Swallow the \n of a \r\n pair.
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  // Trailing field/row when the file doesn't end in a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop entirely blank rows, which exports often end with.
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Normalises a header for matching: lowercase, alphanumerics only. */
export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Finds the index of the first column whose normalised header matches any of
 * the given candidates. Exact matches win over partial ones so that, e.g.,
 * "Fat (g)" is preferred over "Saturated Fat" when looking for fat.
 */
export function findColumn(headers: string[], candidates: string[]): number {
  const norm = headers.map(normaliseHeader);
  for (const candidate of candidates) {
    const exact = norm.indexOf(candidate);
    if (exact !== -1) return exact;
  }
  for (const candidate of candidates) {
    const partial = norm.findIndex((h) => h.includes(candidate));
    if (partial !== -1) return partial;
  }
  return -1;
}

/** Parses a number from a CSV cell, tolerating units, commas and blanks. */
export function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parses the date formats these exports actually use, returning YYYY-MM-DD.
 * Handles ISO, and both US (MM/DD/YYYY) and common Indian (DD-MM-YYYY)
 * orderings — the ambiguous ones are resolved by `dayFirst`.
 */
export function parseDate(value: string | undefined, dayFirst = false): string | null {
  if (!value) return null;
  const trimmed = value.trim();

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slashed = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashed) {
    const a = Number(slashed[1]);
    const b = Number(slashed[2]);
    const year = slashed[3];
    // If one part can't be a month, it must be the day regardless of setting.
    const dayIsFirst = a > 12 ? true : b > 12 ? false : dayFirst;
    const day = dayIsFirst ? a : b;
    const month = dayIsFirst ? b : a;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
      parsed.getDate()
    ).padStart(2, '0')}`;
  }

  return null;
}
