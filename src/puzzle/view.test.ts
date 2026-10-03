import { describe, expect, it } from 'vitest';
import { clampView, IDENTITY_VIEW, MAX_ZOOM, panBy, pinchView, probePoints, toTable, zoomAt } from './view';

const bounds = { w: 1000, h: 800 };

describe('toTable', () => {
  it('maps screen points through the view', () => {
    expect(toTable(IDENTITY_VIEW, 30, 40)).toEqual([30, 40]);
    expect(toTable({ zoom: 2, x: 100, y: 50 }, 30, 40)).toEqual([115, 70]);
  });
});

describe('zoomAt', () => {
  it('keeps the point under the cursor fixed', () => {
    const v = zoomAt(IDENTITY_VIEW, 2, 400, 300, bounds);
    expect(v.zoom).toBe(2);
    expect(toTable(v, 400, 300)).toEqual([400, 300]);
  });

  it('limits the zoom range', () => {
    expect(zoomAt(IDENTITY_VIEW, 0.5, 0, 0, bounds)).toEqual(IDENTITY_VIEW);
    expect(zoomAt(IDENTITY_VIEW, 100, 500, 400, bounds).zoom).toBe(MAX_ZOOM);
  });

  it('snaps back inside the table when zooming out near an edge', () => {
    const zoomed = zoomAt(IDENTITY_VIEW, 2, 1000, 800, bounds);
    expect(zoomed).toEqual({ zoom: 2, x: 500, y: 400 });
    expect(zoomAt(zoomed, 0.5, 0, 0, bounds)).toEqual(IDENTITY_VIEW);
  });
});

describe('panBy', () => {
  it('moves the table with the drag', () => {
    const v = panBy({ zoom: 2, x: 200, y: 200 }, 100, -50, bounds);
    expect(v).toEqual({ zoom: 2, x: 150, y: 225 });
  });

  it('stops at the table edges', () => {
    expect(panBy({ zoom: 2, x: 10, y: 10 }, 500, 500, bounds)).toEqual({ zoom: 2, x: 0, y: 0 });
    expect(panBy({ zoom: 2, x: 10, y: 10 }, -5000, -5000, bounds)).toEqual({ zoom: 2, x: 500, y: 400 });
    expect(panBy(IDENTITY_VIEW, 100, 100, bounds)).toEqual(IDENTITY_VIEW);
  });
});

describe('clampView', () => {
  it('pulls the view back inside smaller bounds', () => {
    expect(clampView({ zoom: 2, x: 500, y: 400 }, { w: 600, h: 400 })).toEqual({ zoom: 2, x: 300, y: 200 });
  });
});

describe('pinchView', () => {
  const p = (x: number, y: number) => ({ x, y });

  it('zooms with the finger spread, keeping the midpoint in place', () => {
    const v = pinchView(IDENTITY_VIEW, p(400, 300), p(500, 300), p(350, 300), p(550, 300), bounds);
    expect(v.zoom).toBe(2);
    expect(toTable(v, 450, 300)).toEqual([450, 300]);
  });

  it('pans when both fingers move together', () => {
    const start = { zoom: 2, x: 200, y: 200 };
    const v = pinchView(start, p(100, 100), p(200, 100), p(150, 120), p(250, 120), bounds);
    expect(v.zoom).toBe(2);
    expect(v).toEqual({ zoom: 2, x: 175, y: 190 });
  });

  it('stays in range and inside the table', () => {
    const v = pinchView(IDENTITY_VIEW, p(400, 300), p(500, 300), p(440, 300), p(460, 300), bounds);
    expect(v).toEqual(IDENTITY_VIEW);
    expect(pinchView(IDENTITY_VIEW, p(0, 0), p(10, 0), p(0, 0), p(1000, 0), bounds).zoom).toBe(MAX_ZOOM);
  });

  it('ignores fingers that start on the same spot', () => {
    expect(pinchView(IDENTITY_VIEW, p(5, 5), p(5, 5), p(0, 0), p(100, 0), bounds).zoom).toBe(1);
  });
});

describe('probePoints', () => {
  it('rings the point at half and full radius, nearest first', () => {
    const pts = probePoints(10, 20, 8);
    expect(pts).toHaveLength(16);
    const dist = pts.map((q) => Math.hypot(q.x - 10, q.y - 20));
    for (const d of dist.slice(0, 8)) expect(d).toBeCloseTo(4);
    for (const d of dist.slice(8)) expect(d).toBeCloseTo(8);
    expect(pts[0].x).toBeCloseTo(14);
    expect(pts[0].y).toBeCloseTo(20);
  });
});
