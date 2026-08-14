import { describe, expect, it } from 'vitest';
import { chunkCsv, splitCsvRows } from '../csvChunk';

describe('splitCsvRows', () => {
  it('keeps a quoted newline inside one logical row', () => {
    expect(splitCsvRows('a,b\n1,"x\ny"')).toHaveLength(2);
  });

  it('handles CRLF line endings', () => {
    expect(splitCsvRows('a,b\r\n1,2\r\n3,4')).toEqual(['a,b', '1,2', '3,4']);
  });

  it('strips blank lines', () => {
    expect(splitCsvRows('a,b\n\n1,2\n\n')).toEqual(['a,b', '1,2']);
  });
});

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

  it('strips a UTF-8 BOM from the header', () => {
    expect(chunkCsv('﻿Date,Food\n2026-08-01,Dal').chunks[0].split('\n')[0]).toBe('Date,Food');
  });

  it('returns nothing for an empty file', () => {
    expect(chunkCsv('')).toEqual({ chunks: [], totalDataRows: 0 });
  });
});
