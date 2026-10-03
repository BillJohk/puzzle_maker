import { describe, expect, it } from 'vitest';
import { fitSize, nextPreviewMode, parsePreviewMode } from './preview';

describe('nextPreviewMode', () => {
  it('cycles off → ghost → thumbnail → off', () => {
    expect(nextPreviewMode('off')).toBe('ghost');
    expect(nextPreviewMode('ghost')).toBe('thumbnail');
    expect(nextPreviewMode('thumbnail')).toBe('off');
  });
});

describe('parsePreviewMode', () => {
  it('accepts known modes and falls back to off', () => {
    expect(parsePreviewMode('ghost')).toBe('ghost');
    expect(parsePreviewMode('thumbnail')).toBe('thumbnail');
    expect(parsePreviewMode(null)).toBe('off');
    expect(parsePreviewMode('sepia')).toBe('off');
  });
});

describe('fitSize', () => {
  it('scales a wide image to the max width', () => {
    expect(fitSize(1600, 900, 200, 200)).toEqual({ w: 200, h: 113 });
  });

  it('scales a tall image to the max height', () => {
    expect(fitSize(600, 1200, 200, 150)).toEqual({ w: 75, h: 150 });
  });

  it('never upscales a small image', () => {
    expect(fitSize(80, 60, 200, 150)).toEqual({ w: 80, h: 60 });
  });
});
