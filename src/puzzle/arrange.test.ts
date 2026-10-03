import { describe, expect, it } from 'vitest';
import { chooseArea, isEdgePiece, overlaps, packInArea, planPacking, stripsAround } from './arrange';

describe('isEdgePiece', () => {
  it('marks the outer ring of the grid', () => {
    const edges = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if (isEdgePiece(r, c, 3, 4)) edges.push([r, c]);
    expect(edges).toHaveLength(10);
    expect(isEdgePiece(1, 1, 3, 4)).toBe(false);
    expect(isEdgePiece(1, 2, 3, 4)).toBe(false);
  });

  it('treats every piece of a single row as an edge', () => {
    expect(isEdgePiece(0, 3, 1, 5)).toBe(true);
  });
});

describe('overlaps', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };

  it('detects intersecting rectangles', () => {
    expect(overlaps(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps(a, { x: 2, y: 2, w: 2, h: 2 })).toBe(true);
  });

  it('treats touching edges as apart', () => {
    expect(overlaps(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(overlaps(a, { x: 0, y: 20, w: 5, h: 5 })).toBe(false);
  });
});

describe('stripsAround', () => {
  it('returns the four margins around the board', () => {
    expect(stripsAround({ w: 100, h: 80 }, { x: 20, y: 10, w: 50, h: 40 })).toEqual([
      { x: 0, y: 0, w: 20, h: 80 },
      { x: 70, y: 0, w: 30, h: 80 },
      { x: 0, y: 0, w: 100, h: 10 },
      { x: 0, y: 50, w: 100, h: 30 },
    ]);
  });
});

describe('planPacking', () => {
  const item = { w: 10, h: 10 };

  it('fits items side by side when there is room', () => {
    expect(planPacking(6, { x: 0, y: 0, w: 30, h: 20 }, item)).toMatchObject({ cols: 3, rows: 2, score: 1 });
  });

  it('spreads overlap across both directions when crowded', () => {
    // 8 items in room for 2 × 2: two columns of four rows would hide most of each piece.
    const plan = planPacking(8, { x: 0, y: 0, w: 20, h: 20 }, item);
    expect(plan.score).toBeGreaterThan(0);
    expect(plan.score).toBeLessThan(1);
    expect(plan.cols * plan.rows).toBeGreaterThanOrEqual(8);
  });
});

describe('chooseArea', () => {
  const item = { w: 10, h: 10 };
  const small = { x: 0, y: 0, w: 20, h: 20 }; // holds 4 without overlap
  const big = { x: 50, y: 0, w: 40, h: 40 }; // holds 16

  it('prefers the first area with room for everything', () => {
    expect(chooseArea([small, big], 4, item)).toBe(small);
    expect(chooseArea([small, big], 5, item)).toBe(big);
  });

  it('falls back to the area where pieces overlap least', () => {
    expect(chooseArea([small, big], 100, item)).toBe(big);
  });
});

describe('packInArea', () => {
  const item = { w: 10, h: 10 };

  it('lays items out in rows, centered in the area', () => {
    expect(packInArea(3, { x: 0, y: 0, w: 25, h: 25 }, item)).toEqual([
      { x: 2.5, y: 2.5 },
      { x: 12.5, y: 2.5 },
      { x: 2.5, y: 12.5 },
    ]);
  });

  it('overlaps items to keep every one inside a crowded area', () => {
    const area = { x: 0, y: 100, w: 20, h: 30 };
    const pos = packInArea(12, area, item);
    expect(pos).toHaveLength(12);
    for (const p of pos) {
      expect(p.x).toBeGreaterThanOrEqual(area.x);
      expect(p.x + item.w).toBeLessThanOrEqual(area.x + area.w + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(area.y);
      expect(p.y + item.h).toBeLessThanOrEqual(area.y + area.h + 1e-9);
    }
    expect(new Set(pos.map((p) => `${p.x},${p.y}`)).size).toBe(12);
  });

  it('keeps items at the corner of an area smaller than one item', () => {
    expect(packInArea(2, { x: 5, y: 5, w: 4, h: 4 }, item)).toEqual([
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ]);
  });

  it('returns nothing for no items', () => {
    expect(packInArea(0, { x: 0, y: 0, w: 10, h: 10 }, item)).toEqual([]);
  });
});
