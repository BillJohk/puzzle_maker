import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng';
import { createLayout, pieceSides, piecePadding, tracePiece, type PathSink } from './shape';

const layout = createLayout(4, 5, 80, 60, mulberry32(42));

describe('pieceSides', () => {
  it('makes border sides straight and interior sides tabbed', () => {
    const corner = pieceSides(layout, 0, 0);
    expect(corner.top).toHaveLength(2);
    expect(corner.left).toHaveLength(2);
    expect(corner.right).toHaveLength(10);
    expect(corner.bottom).toHaveLength(10);

    const last = pieceSides(layout, 3, 4);
    expect(last.bottom).toHaveLength(2);
    expect(last.right).toHaveLength(2);

    const inner = pieceSides(layout, 1, 2);
    for (const side of Object.values(inner)) expect(side).toHaveLength(10);
  });

  it('gives neighbors exactly complementary edges', () => {
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const here = pieceSides(layout, r, c);
        if (r + 1 < layout.rows) {
          expect([...pieceSides(layout, r + 1, c).top].reverse()).toEqual(here.bottom);
        }
        if (c + 1 < layout.cols) {
          expect([...pieceSides(layout, r, c + 1).left].reverse()).toEqual(here.right);
        }
      }
    }
  });

  it('produces closed outlines whose sides join end to end', () => {
    const s = pieceSides(layout, 2, 3);
    const chain = [s.top, s.right, s.bottom, s.left];
    for (let i = 0; i < 4; i++) {
      const end = chain[i][chain[i].length - 1];
      const nextStart = chain[(i + 1) % 4][0];
      expect(end.x).toBeCloseTo(nextStart.x);
      expect(end.y).toBeCloseTo(nextStart.y);
    }
  });

  it('keeps every control point within the padded cell', () => {
    const pad = piecePadding(layout);
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        for (const p of Object.values(pieceSides(layout, r, c)).flat()) {
          expect(p.x).toBeGreaterThanOrEqual(c * layout.cellW - pad);
          expect(p.x).toBeLessThanOrEqual((c + 1) * layout.cellW + pad);
          expect(p.y).toBeGreaterThanOrEqual(r * layout.cellH - pad);
          expect(p.y).toBeLessThanOrEqual((r + 1) * layout.cellH + pad);
        }
      }
    }
  });

  it('is deterministic for a given seed', () => {
    expect(createLayout(4, 5, 80, 60, mulberry32(42))).toEqual(layout);
  });
});

describe('tracePiece', () => {
  it('emits lines for flat sides and three curves per tabbed side', () => {
    const calls: string[] = [];
    const sink: PathSink = {
      moveTo: () => calls.push('M'),
      lineTo: () => calls.push('L'),
      bezierCurveTo: () => calls.push('C'),
      closePath: () => calls.push('Z'),
    };
    tracePiece(pieceSides(layout, 0, 0), sink);
    expect(calls.join('')).toBe('MLCCCCCCLZ');
  });
});
