export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/** True for pieces on the puzzle's outer border (corners included). */
export function isEdgePiece(row: number, col: number, rows: number, cols: number): boolean {
  return row === 0 || col === 0 || row === rows - 1 || col === cols - 1;
}

export function overlaps(a: Area, b: Area): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The free strips of the table around the board: left, right, top, bottom. */
export function stripsAround(table: Size, board: Area): Area[] {
  const right = board.x + board.w;
  const bottom = board.y + board.h;
  return [
    { x: 0, y: 0, w: board.x, h: table.h },
    { x: right, y: 0, w: table.w - right, h: table.h },
    { x: 0, y: 0, w: table.w, h: board.y },
    { x: 0, y: bottom, w: table.w, h: table.h - bottom },
  ];
}

export interface Packing {
  cols: number;
  rows: number;
  stepX: number;
  stepY: number;
  /** Roughly the fraction of each item left uncovered (1 = no overlap). */
  score: number;
}

/** Spacing along one axis for `count` items of size `item` in `room`, and the fraction of each left showing. */
function axis(count: number, item: number, room: number): { step: number; shown: number } {
  if (count === 1) return { step: item, shown: Math.min(1, room / item) };
  const step = Math.min(item, Math.max(0, (room - item) / (count - 1)));
  return { step, shown: step / item };
}

/**
 * Picks the grid for `n` items in the area that leaves the most of each item
 * showing. When they don't fit side by side they overlap like shingles, but
 * always stay inside the area (as far as an item larger than the area allows).
 */
export function planPacking(n: number, area: Area, item: Size): Packing {
  let best: Packing = { cols: 1, rows: n, stepX: item.w, stepY: 0, score: -1 };
  for (let cols = 1; cols <= Math.max(1, n); cols++) {
    const rows = Math.ceil(n / cols);
    const x = axis(cols, item.w, area.w);
    const y = axis(rows, item.h, area.h);
    const score = x.shown * y.shown;
    if (score > best.score) best = { cols, rows, stepX: x.step, stepY: y.step, score };
  }
  return best;
}

/** The area where the items overlap least; earlier areas win ties. */
export function chooseArea(areas: readonly Area[], n: number, item: Size): Area {
  let best = areas[0];
  let bestScore = -1;
  for (const a of areas) {
    const { score } = planPacking(n, a, item);
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return best;
}

/** Top-left positions for `n` items packed into the area (see planPacking), centered when there is room. */
export function packInArea(n: number, area: Area, item: Size): { x: number; y: number }[] {
  if (n <= 0) return [];
  const { cols, rows, stepX, stepY } = planPacking(n, area, item);
  const blockW = (cols - 1) * stepX + item.w;
  const blockH = (rows - 1) * stepY + item.h;
  const x0 = area.x + Math.max(0, (area.w - blockW) / 2);
  const y0 = area.y + Math.max(0, (area.h - blockH) / 2);
  return Array.from({ length: n }, (_, i) => ({
    x: x0 + (i % cols) * stepX,
    y: y0 + Math.floor(i / cols) * stepY,
  }));
}

/**
 * Bounding box of a group of cell boxes, each given by its unrotated top-left
 * corner and quarter turns. A turned box spins about its center, so odd turns
 * swap its width and height.
 */
export function groupBounds(
  members: readonly { x: number; y: number; rotation: number }[],
  cellW: number,
  cellH: number,
): Area {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of members) {
    const [w, h] = m.rotation % 2 === 0 ? [cellW, cellH] : [cellH, cellW];
    const cx = m.x + cellW / 2;
    const cy = m.y + cellH / 2;
    x0 = Math.min(x0, cx - w / 2);
    y0 = Math.min(y0, cy - h / 2);
    x1 = Math.max(x1, cx + w / 2);
    y1 = Math.max(y1, cy + h / 2);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * A random top-left corner for a box of `size` inside the table (keeping
 * `margin` from its edges where possible), retrying a few times to avoid the
 * given areas. If every try overlaps, the last one is used.
 */
export function randomSpot(
  table: Size,
  size: Size,
  margin: number,
  avoid: readonly Area[],
  rand: () => number,
  attempts = 30,
): { x: number; y: number } {
  const maxX = Math.max(margin, table.w - size.w - margin);
  const maxY = Math.max(margin, table.h - size.h - margin);
  let pos = { x: margin, y: margin };
  for (let i = 0; i < attempts; i++) {
    pos = { x: margin + rand() * (maxX - margin), y: margin + rand() * (maxY - margin) };
    const box = { x: pos.x, y: pos.y, w: size.w, h: size.h };
    if (!avoid.some((a) => overlaps(box, a))) break;
  }
  return pos;
}
