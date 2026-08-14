/**
 * Splits a large CSV into smaller CSVs so a big export can be imported as a
 * series of small requests instead of one huge one that would hit the body
 * limit or time out.
 *
 * The splitting is quote-aware. A naive split on "\n" corrupts any row with a
 * newline inside a quoted field — food notes and recipe descriptions in real
 * exports do contain them — which would silently mangle rows rather than fail
 * loudly.
 */

/** Splits CSV text into logical rows, respecting newlines inside quotes. */
export function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      // A doubled quote inside a quoted field is an escaped quote, not a close.
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      if (current.trim() !== '') rows.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim() !== '') rows.push(current);
  return rows;
}

export interface CsvChunks {
  /** Each chunk is a complete, valid CSV: the header plus a slice of rows. */
  chunks: string[];
  /** Data rows across the whole file, excluding the header. */
  totalDataRows: number;
}

export function chunkCsv(text: string, rowsPerChunk = 500): CsvChunks {
  const rows = splitCsvRows(text.replace(/^﻿/, ''));
  if (rows.length === 0) return { chunks: [], totalDataRows: 0 };

  const header = rows[0];
  const dataRows = rows.slice(1);

  if (dataRows.length === 0) {
    return { chunks: [header], totalDataRows: 0 };
  }

  const chunks: string[] = [];
  for (let i = 0; i < dataRows.length; i += rowsPerChunk) {
    chunks.push([header, ...dataRows.slice(i, i + rowsPerChunk)].join('\n'));
  }

  return { chunks, totalDataRows: dataRows.length };
}
