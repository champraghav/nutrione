import { describe, it, expect } from 'vitest';

// Mirrors web/src/utils/csvChunk.ts
function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '""'; i += 1; continue; }
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

function chunkCsv(text: string, rowsPerChunk = 500) {
  const rows = splitCsvRows(text.replace(/^﻿/, ''));
  if (rows.length === 0) return { chunks: [], totalDataRows: 0 };
  const header = rows[0];
  const dataRows = rows.slice(1);
  if (dataRows.length === 0) return { chunks: [header], totalDataRows: 0 };
  const chunks: string[] = [];
  for (let i = 0; i < dataRows.length; i += rowsPerChunk) {
    chunks.push([header, ...dataRows.slice(i, i + rowsPerChunk)].join('\n'));
  }
  return { chunks, totalDataRows: dataRows.length };
}

describe('chunkCsv', () => {
  it('gives every chunk the header so each is a valid CSV on its own', () => {
    const csv = ['Date,Food', ...Array.from({ length: 12 }, (_, i) => `2026-08-0${(i % 9) + 1},Item${i}`)].join('\n');
    const { chunks, totalDataRows } = chunkCsv(csv, 5);
    expect(totalDataRows).toBe(12);
    expect(chunks).toHaveLength(3);
    for (const c of chunks) expect(c.split('\n')[0]).toBe('Date,Food');
    // No row is lost or duplicated across the split.
    const dataLines = chunks.flatMap((c) => c.split('\n').slice(1));
    expect(dataLines).toHaveLength(12);
    expect(new Set(dataLines).size).toBe(12);
  });

  it('does not split inside a quoted field containing a newline', () => {
    // A naive split on \n would tear this row in half and corrupt the import.
    const csv = 'Date,Food,Note\n2026-08-01,Dal,"line one\nline two"\n2026-08-02,Rice,plain';
    const { chunks, totalDataRows } = chunkCsv(csv, 500);
    expect(totalDataRows).toBe(2);
    expect(chunks[0].split('\n')).toHaveLength(4); // header + 2 rows, one spanning 2 lines
    expect(chunks[0]).toContain('"line one\nline two"');
  });

  it('preserves escaped double quotes when splitting', () => {
    const csv = 'Date,Food\n2026-08-01,"He said ""hi"""';
    expect(chunkCsv(csv).chunks[0]).toContain('"He said ""hi"""');
  });

  it('handles a header-only file without crashing', () => {
    expect(chunkCsv('Date,Food').totalDataRows).toBe(0);
  });
});
