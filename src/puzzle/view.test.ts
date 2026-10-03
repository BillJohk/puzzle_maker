import { describe, expect, it } from 'vitest';
import { clampView, IDENTITY_VIEW, MAX_ZOOM, panBy, toTable, zoomAt } from './view';

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
