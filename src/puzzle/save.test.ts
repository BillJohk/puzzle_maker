import { describe, expect, it } from 'vitest';
import { fromSaved, parseSaved, SAVE_VERSION, toSaved, type BoardFrame, type SaveMeta } from './save';
import type { SnapPiece } from './snap';

const meta: SaveMeta = { seed: 42, rows: 1, cols: 2, pieceCount: 2, rotate: true, elapsedMs: 1234, moves: 5 };
const frame: BoardFrame = { boardX: 100, boardY: 50, cellW: 40, cellH: 20 };

const pieces: SnapPiece[] = [
  { row: 0, col: 1, x: 180, y: 70, rotation: 2, group: 1, locked: false },
  { row: 0, col: 0, x: 100, y: 50, rotation: 0, group: 0, locked: true },
];

describe('toSaved / fromSaved', () => {
  it('stores positions relative to the board in cell units', () => {
    const saved = toSaved(pieces, meta, frame);
    expect(saved.version).toBe(SAVE_VERSION);
    expect(saved.pieces[0]).toMatchObject({ row: 0, col: 1, x: 2, y: 1, rotation: 2, group: 1 });
    expect(saved.pieces[1]).toMatchObject({ x: 0, y: 0, locked: true });
  });

  it('round-trips through JSON onto a differently sized board', () => {
    const saved = parseSaved(JSON.parse(JSON.stringify(toSaved(pieces, meta, frame))))!;
    expect(saved).not.toBeNull();
    const bigger: BoardFrame = { boardX: 10, boardY: 20, cellW: 80, cellH: 40 };
    const restored = fromSaved(saved, bigger);
    expect(restored.map((p) => [p.row, p.col])).toEqual([
      [0, 1],
      [0, 0],
    ]);
    expect(restored[0]).toMatchObject({ x: 10 + 2 * 80, y: 20 + 40, rotation: 2, group: 1, locked: false });
    expect(restored[1]).toMatchObject({ x: 10, y: 20, locked: true });
    expect(fromSaved(saved, frame)).toEqual(pieces);
  });
});

describe('parseSaved', () => {
  const valid = () => JSON.parse(JSON.stringify(toSaved(pieces, meta, frame)));

  it('accepts a valid save', () => {
    expect(parseSaved(valid())).toEqual(valid());
  });

  it('rejects non-objects and other versions', () => {
    expect(parseSaved(null)).toBeNull();
    expect(parseSaved('save')).toBeNull();
    expect(parseSaved({ ...valid(), version: 99 })).toBeNull();
  });

  it('rejects a piece list that does not cover every cell exactly once', () => {
    const missing = valid();
    missing.pieces.pop();
    expect(parseSaved(missing)).toBeNull();
    const duplicate = valid();
    duplicate.pieces[0].col = 0;
    expect(parseSaved(duplicate)).toBeNull();
    const outside = valid();
    outside.pieces[0].col = 2;
    expect(parseSaved(outside)).toBeNull();
  });

  it('rejects bad field values', () => {
    const cases: [string, unknown][] = [
      ['rotation', 4],
      ['rotation', 1.5],
      ['x', Number.NaN],
      ['locked', 'yes'],
      ['group', -1],
    ];
    for (const [key, value] of cases) {
      const s = valid();
      s.pieces[0][key] = value;
      expect(parseSaved(s), `${key}=${String(value)}`).toBeNull();
    }
    expect(parseSaved({ ...valid(), moves: -1 })).toBeNull();
    expect(parseSaved({ ...valid(), rotate: 1 })).toBeNull();
  });
});
