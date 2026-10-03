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
