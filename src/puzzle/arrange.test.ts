import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng';
import {
  chooseArea,
  groupBounds,
  isEdgePiece,
  overlaps,
  packInArea,
  planPacking,
  randomSpot,
  stripsAround,
  trimAway,
} from './arrange';

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

describe('groupBounds', () => {
  it('spans the cell boxes of upright pieces', () => {
    const members = [
      { x: 10, y: 20, rotation: 0 },
      { x: 50, y: 20, rotation: 0 },
      { x: 10, y: 50, rotation: 0 },
    ];
    expect(groupBounds(members, 40, 30)).toEqual({ x: 10, y: 20, w: 80, h: 60 });
  });

  it('swaps width and height of quarter-turned boxes about their centers', () => {
    // A 40 × 20 box at (0, 0) has center (20, 10); turned it is 20 × 40.
    expect(groupBounds([{ x: 0, y: 0, rotation: 1 }], 40, 20)).toEqual({ x: 10, y: -10, w: 20, h: 40 });
    expect(groupBounds([{ x: 0, y: 0, rotation: 2 }], 40, 20)).toEqual({ x: 0, y: 0, w: 40, h: 20 });
  });
});

describe('randomSpot', () => {
  const table = { w: 300, h: 200 };
  const size = { w: 40, h: 30 };

  it('stays inside the table margins', () => {
    const rand = mulberry32(1);
    for (let i = 0; i < 50; i++) {
      const p = randomSpot(table, size, 5, [], rand);
      expect(p.x).toBeGreaterThanOrEqual(5);
      expect(p.y).toBeGreaterThanOrEqual(5);
      expect(p.x + size.w).toBeLessThanOrEqual(table.w - 5);
      expect(p.y + size.h).toBeLessThanOrEqual(table.h - 5);
    }
  });

  it('avoids the given areas when it can', () => {
    const rand = mulberry32(7);
    const board = { x: 100, y: 0, w: 100, h: 200 };
    for (let i = 0; i < 50; i++) {
      expect(overlaps({ ...randomSpot(table, size, 0, [board], rand), ...size }, board)).toBe(false);
    }
  });

  it('accepts a positioned box as the size', () => {
    // A group's bounding box carries its old x/y, which must not be mistaken for the new spot.
    const rand = mulberry32(3);
    const board = { x: 100, y: 0, w: 100, h: 200 };
    const box = { x: 120, y: 50, ...size };
    for (let i = 0; i < 50; i++) {
      const p = randomSpot(table, box, 0, [board], rand);
      expect(overlaps({ x: p.x, y: p.y, w: box.w, h: box.h }, board)).toBe(false);
    }
  });
});

describe('trimAway', () => {
  const strip = { x: 600, y: 0, w: 200, h: 600 };

  it('leaves an area that is already clear alone', () => {
    expect(trimAway(strip, { x: 0, y: 0, w: 100, h: 100 })).toBe(strip);
  });

  it('keeps the larger part beside a corner cover', () => {
    // A thumbnail in the top-right corner: the strip below it is bigger than the one beside it.
    expect(trimAway(strip, { x: 650, y: 10, w: 140, h: 100 })).toEqual({ x: 600, y: 110, w: 200, h: 490 });
  });

  it('returns an empty area when the cover takes everything', () => {
    const area = trimAway(strip, { x: 500, y: -10, w: 400, h: 700 });
    expect(area.w * area.h).toBe(0);
  });
});
