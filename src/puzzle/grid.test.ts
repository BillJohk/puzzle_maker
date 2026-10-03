import { describe, expect, it } from 'vitest';
import { chooseGrid } from './grid';

describe('chooseGrid', () => {
  it('uses a square grid for square images', () => {
    expect(chooseGrid(100, 1)).toEqual({ rows: 10, cols: 10 });
    expect(chooseGrid(48, 1)).toEqual({ rows: 7, cols: 7 });
  });

  it('puts more columns on landscape images and more rows on portrait images', () => {
    expect(chooseGrid(50, 2)).toEqual({ rows: 5, cols: 10 });
    expect(chooseGrid(50, 0.5)).toEqual({ rows: 10, cols: 5 });
  });

  it('keeps cells roughly square and the count close to the request', () => {
    for (const aspect of [0.5, 0.75, 1, 4 / 3, 16 / 9, 3]) {
      for (const n of [12, 24, 48, 100, 150, 200, 300]) {
        const { rows, cols } = chooseGrid(n, aspect);
        const cellAspect = (aspect / cols) * rows;
        expect(cellAspect).toBeGreaterThan(0.6);
        expect(cellAspect).toBeLessThan(1.6);
        expect(Math.abs(rows * cols - n) / n).toBeLessThan(0.25);
      }
    }
  });

  it('never returns an empty grid', () => {
    expect(chooseGrid(1, 10)).toEqual({ rows: 1, cols: 3 });
    expect(chooseGrid(0, 1)).toEqual({ rows: 1, cols: 1 });
  });
});
