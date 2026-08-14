import { describe, expect, it } from 'vitest';
import { dataUrlBytes, targetDimensions } from '../image';

describe('targetDimensions', () => {
  it('scales a landscape photo down by its long edge', () => {
    expect(targetDimensions(4032, 3024, 1024)).toEqual({ width: 1024, height: 768 });
  });

  it('scales a portrait photo down by its long edge', () => {
    expect(targetDimensions(3024, 4032, 1024)).toEqual({ width: 768, height: 1024 });
  });

  it('leaves a photo already within the limit alone', () => {
    expect(targetDimensions(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });

  it('never enlarges a small photo', () => {
    const out = targetDimensions(200, 100, 1024);
    expect(out.width).toBe(200);
    expect(out.height).toBe(100);
  });

  it('keeps the exact-limit case unchanged', () => {
    expect(targetDimensions(1024, 512, 1024)).toEqual({ width: 1024, height: 512 });
  });

  it('never rounds a dimension down to zero', () => {
    const out = targetDimensions(10000, 3, 1024);
    expect(out.height).toBeGreaterThanOrEqual(1);
  });

  it('survives a zero-sized image without dividing by zero', () => {
    expect(targetDimensions(0, 0, 1024)).toEqual({ width: 0, height: 0 });
  });
});

describe('dataUrlBytes', () => {
  it('measures the decoded payload, not the base64 text', () => {
    // "hello" is 5 bytes, 8 base64 chars with one '=' of padding.
    expect(dataUrlBytes('data:text/plain;base64,aGVsbG8=')).toBe(5);
  });

  it('handles two padding characters', () => {
    // "hi" is 2 bytes.
    expect(dataUrlBytes('data:text/plain;base64,aGk=')).toBe(2);
  });

  it('returns 0 for something that is not a data URL', () => {
    expect(dataUrlBytes('not-a-data-url')).toBe(0);
  });
});
