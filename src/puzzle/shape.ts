export interface Point {
  x: number;
  y: number;
}

/** Random parameters for one interior edge, shared by the two pieces it separates. */
export interface EdgeParams {
  /** Which side the tab bulges toward: +1 = toward the higher row/col, -1 = the lower. */
  flip: 1 | -1;
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
}

export interface PuzzleLayout {
  rows: number;
  cols: number;
  cellW: number;
  cellH: number;
  /** (rows - 1) × cols: horizontal[i][c] lies between row i and row i + 1. */
  horizontal: EdgeParams[][];
  /** rows × (cols - 1): vertical[r][j] lies between col j and col j + 1. */
  vertical: EdgeParams[][];
}

/** Each side is either a straight segment [start, end] or a 10-point chain of 3 cubic Béziers. */
export interface PieceSides {
  top: Point[];
  right: Point[];
  bottom: Point[];
  left: Point[];
}

/** Path sink compatible with Path2D and CanvasRenderingContext2D. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  closePath(): void;
}

/** Tab size as a fraction of the edge; a tab reaches at most ~0.29 of the cell's short side. */
const TAB = 0.09;
const MAX_TAB_REACH = 0.3;

function randomEdge(rand: () => number): EdgeParams {
  const jitter = (range: number) => (rand() * 2 - 1) * range;
  return {
    flip: rand() < 0.5 ? 1 : -1,
    a: jitter(0.03),
    b: jitter(0.04),
    c: jitter(0.02),
    d: jitter(0.03),
    e: jitter(0.03),
  };
}

export function createLayout(
  rows: number,
  cols: number,
  cellW: number,
  cellH: number,
  rand: () => number,
): PuzzleLayout {
  const horizontal = Array.from({ length: rows - 1 }, () =>
    Array.from({ length: cols }, () => randomEdge(rand)),
  );
  const vertical = Array.from({ length: rows }, () =>
    Array.from({ length: cols - 1 }, () => randomEdge(rand)),
  );
  return { rows, cols, cellW, cellH, horizontal, vertical };
}

/**
 * Classic jigsaw tab as 10 control points in edge space: u runs 0→1 along the
 * edge, v is perpendicular (scaled by the cell's short side), signed by flip.
 */
export function edgeCurve(edge: EdgeParams): [number, number][] {
  const { a, b, c, d, e, flip } = edge;
  const t = TAB;
  const pts: [number, number][] = [
    [0, 0],
    [0.2, a],
    [0.5 + b + d, -t + c],
    [0.5 - t + b, t + c],
    [0.5 - 2 * t + b - d, 3 * t + c],
    [0.5 + 2 * t + b - d, 3 * t + c],
    [0.5 + t + b, t + c],
    [0.5 + b + d, -t + c],
    [0.8, e],
    [1, 0],
  ];
  return pts.map(([u, v]) => [u, v * flip]);
}

/** Extra margin around a cell so a piece's sprite isn't clipped where tabs stick out. */
export function piecePadding(layout: PuzzleLayout): number {
  return Math.ceil(MAX_TAB_REACH * Math.min(layout.cellW, layout.cellH)) + 2;
}

/**
 * Position along an edge of length `len`. The bulb's control points (2–7) are
 * scaled by the cell's short side `s` around the midpoint so tabs keep their
 * shape on non-square cells; the ends and shoulders stretch with the edge.
 */
function alongEdge(index: number, u: number, len: number, s: number): number {
  return index >= 2 && index <= 7 ? len / 2 + (u - 0.5) * s : u * len;
}

/** Points of horizontal edge i at column c, in board coordinates, running left → right. */
function horizontalEdgePoints(layout: PuzzleLayout, i: number, c: number): Point[] {
  const { cellW: w, cellH: h } = layout;
  const s = Math.min(w, h);
  return edgeCurve(layout.horizontal[i][c]).map(([u, v], k) => ({
    x: c * w + alongEdge(k, u, w, s),
    y: (i + 1) * h + v * s,
  }));
}

/** Points of vertical edge j at row r, in board coordinates, running top → bottom. */
function verticalEdgePoints(layout: PuzzleLayout, r: number, j: number): Point[] {
  const { cellW: w, cellH: h } = layout;
  const s = Math.min(w, h);
  return edgeCurve(layout.vertical[r][j]).map(([u, v], k) => ({
    x: (j + 1) * w + v * s,
    y: r * h + alongEdge(k, u, h, s),
  }));
}

/**
 * Outline of piece (r, c) in board coordinates, traced clockwise from its
 * top-left corner. Neighbors reference the same edge points (reversed), so
 * adjacent pieces fit exactly; border sides are straight.
 */
export function pieceSides(layout: PuzzleLayout, r: number, c: number): PieceSides {
  const { rows, cols, cellW: w, cellH: h } = layout;
  const x0 = c * w;
  const y0 = r * h;
  const x1 = (c + 1) * w;
  const y1 = (r + 1) * h;

  const top =
    r === 0 ? [{ x: x0, y: y0 }, { x: x1, y: y0 }] : horizontalEdgePoints(layout, r - 1, c);
  const right =
    c === cols - 1 ? [{ x: x1, y: y0 }, { x: x1, y: y1 }] : verticalEdgePoints(layout, r, c);
  const bottom =
    r === rows - 1
      ? [{ x: x1, y: y1 }, { x: x0, y: y1 }]
      : horizontalEdgePoints(layout, r, c).reverse();
  const left =
    c === 0
      ? [{ x: x0, y: y1 }, { x: x0, y: y0 }]
      : verticalEdgePoints(layout, r, c - 1).reverse();

  return { top, right, bottom, left };
}

export function tracePiece(sides: PieceSides, sink: PathSink): void {
  sink.moveTo(sides.top[0].x, sides.top[0].y);
  for (const side of [sides.top, sides.right, sides.bottom, sides.left]) {
    if (side.length === 2) {
      sink.lineTo(side[1].x, side[1].y);
    } else {
      for (let i = 1; i < side.length; i += 3) {
        const [p1, p2, p3] = [side[i], side[i + 1], side[i + 2]];
        sink.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
    }
  }
  sink.closePath();
}
