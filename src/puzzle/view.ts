/**
 * A zoomed view of the table. (x, y) is the table point shown at the top-left
 * of the screen, and a table point p appears at (p - (x, y)) × zoom.
 */
export interface View {
  zoom: number;
  x: number;
  y: number;
}

export interface Bounds {
  w: number;
  h: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export const IDENTITY_VIEW: View = { zoom: 1, x: 0, y: 0 };

/** Screen point → table point. */
export function toTable(view: View, sx: number, sy: number): [number, number] {
  return [view.x + sx / view.zoom, view.y + sy / view.zoom];
}

/** Keeps the zoom in range and the visible area inside the table. */
export function clampView(view: View, bounds: Bounds): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));
  const maxX = bounds.w - bounds.w / zoom;
  const maxY = bounds.h - bounds.h / zoom;
  return {
    zoom,
    x: Math.min(maxX, Math.max(0, view.x)),
    y: Math.min(maxY, Math.max(0, view.y)),
  };
}

/** Zooms by `factor`, keeping the table point under screen point (sx, sy) in place. */
export function zoomAt(view: View, factor: number, sx: number, sy: number, bounds: Bounds): View {
  const [tx, ty] = toTable(view, sx, sy);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
  return clampView({ zoom, x: tx - sx / zoom, y: ty - sy / zoom }, bounds);
}

/** Moves the view so the table follows a drag of (dsx, dsy) screen pixels. */
export function panBy(view: View, dsx: number, dsy: number, bounds: Bounds): View {
  return clampView({ zoom: view.zoom, x: view.x - dsx / view.zoom, y: view.y - dsy / view.zoom }, bounds);
}

export interface Point {
  x: number;
  y: number;
}

/**
 * The view during a two-finger pinch: the table point that was under the
 * fingers' midpoint at the start stays under their current midpoint, and the
 * zoom scales with the distance between them.
 */
export function pinchView(start: View, a0: Point, b0: Point, a1: Point, b1: Point, bounds: Bounds): View {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const factor = d0 > 0 && d1 > 0 ? d1 / d0 : 1;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom * factor));
  const [tx, ty] = toTable(start, (a0.x + b0.x) / 2, (a0.y + b0.y) / 2);
  const mx = (a1.x + b1.x) / 2;
  const my = (a1.y + b1.y) / 2;
  return clampView({ zoom, x: tx - mx / zoom, y: ty - my / zoom }, bounds);
}

/**
 * Points around (x, y) to probe when a touch misses every piece: rings at
 * half and full `radius`, eight directions each, nearest ring first.
 */
export function probePoints(x: number, y: number, radius: number): Point[] {
  const points: Point[] = [];
  for (const r of [radius / 2, radius]) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      points.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });
    }
  }
  return points;
}
