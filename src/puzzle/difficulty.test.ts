import { describe, expect, it } from 'vitest';
import { MAX_PIECES, MIN_PIECES, parsePieceCount, presetFor, PRESETS } from './difficulty';

describe('parsePieceCount', () => {
  it('reads whole numbers', () => {
    expect(parsePieceCount('64')).toBe(64);
    expect(parsePieceCount(' 120 ')).toBe(120);
  });

  it('rounds fractions', () => {
    expect(parsePieceCount('49.6')).toBe(50);
  });

  it('clamps into range', () => {
    expect(parsePieceCount('1')).toBe(MIN_PIECES);
    expect(parsePieceCount('-20')).toBe(MIN_PIECES);
    expect(parsePieceCount('100000')).toBe(MAX_PIECES);
  });

  it('rejects text that is not a number', () => {
    expect(parsePieceCount('')).toBeNull();
    expect(parsePieceCount('   ')).toBeNull();
    expect(parsePieceCount('lots')).toBeNull();
    expect(parsePieceCount('Infinity')).toBeNull();
  });
});

describe('presetFor', () => {
  it('finds the preset matching count and rotation', () => {
    expect(presetFor(24, false)?.id).toBe('easy');
    expect(presetFor(300, true)?.id).toBe('expert');
  });

  it('returns null for settings no preset uses', () => {
    expect(presetFor(24, true)).toBeNull();
    expect(presetFor(77, false)).toBeNull();
  });

  it('has presets within the allowed range, from easiest to hardest', () => {
    for (const p of PRESETS) {
      expect(p.pieces).toBeGreaterThanOrEqual(MIN_PIECES);
      expect(p.pieces).toBeLessThanOrEqual(MAX_PIECES);
    }
    const counts = PRESETS.map((p) => p.pieces);
    expect([...counts].sort((a, b) => a - b)).toEqual(counts);
  });
});
