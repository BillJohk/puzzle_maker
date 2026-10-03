import type { SnapPiece } from './snap';

export const SAVE_VERSION = 1;

/**
 * A piece as saved: (x, y) is measured from the board's top-left corner in
 * cell units, so the puzzle lines up again on a different window size.
 */
export type SavedPiece = Pick<SnapPiece, 'row' | 'col' | 'x' | 'y' | 'rotation' | 'group' | 'locked'>;

export interface SavedPuzzle {
  version: typeof SAVE_VERSION;
  /** Seed of the cut; with rows and cols it reproduces the piece shapes. */
  seed: number;
  rows: number;
  cols: number;
  /** Piece count the player asked for (rows × cols is often slightly different). */
  pieceCount: number;
  rotate: boolean;
  elapsedMs: number;
  moves: number;
  /** In stacking order, bottom first. */
  pieces: SavedPiece[];
}

/** Where the board sits on screen and how big a cell is, for converting positions. */
export interface BoardFrame {
  boardX: number;
  boardY: number;
  cellW: number;
  cellH: number;
}

export type SaveMeta = Omit<SavedPuzzle, 'version' | 'pieces'>;

export function toSaved(pieces: readonly SnapPiece[], meta: SaveMeta, frame: BoardFrame): SavedPuzzle {
  return {
    version: SAVE_VERSION,
    ...meta,
    pieces: pieces.map((p) => ({
      row: p.row,
      col: p.col,
      x: (p.x - frame.boardX) / frame.cellW,
      y: (p.y - frame.boardY) / frame.cellH,
      rotation: p.rotation,
      group: p.group,
      locked: p.locked,
    })),
  };
}

/** Saved pieces back in screen coordinates for the given board, in stacking order. */
export function fromSaved(saved: SavedPuzzle, frame: BoardFrame): SnapPiece[] {
  return saved.pieces.map((p) => ({
    ...p,
    x: frame.boardX + p.x * frame.cellW,
    y: frame.boardY + p.y * frame.cellH,
  }));
}

const isInt = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Validates stored data and returns it as a SavedPuzzle, or null if it is
 * malformed or from another version. Every cell must appear exactly once.
 */
export function parseSaved(data: unknown): SavedPuzzle | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.version !== SAVE_VERSION) return null;
  if (!isInt(d.seed, 0) || !isInt(d.rows, 1) || !isInt(d.cols, 1) || !isInt(d.pieceCount, 1)) return null;
  if (typeof d.rotate !== 'boolean' || !isNum(d.elapsedMs) || d.elapsedMs < 0 || !isInt(d.moves, 0)) return null;
  const { rows, cols } = d as { rows: number; cols: number };
  if (!Array.isArray(d.pieces) || d.pieces.length !== rows * cols) return null;

  const seen = new Set<number>();
  const pieces: SavedPiece[] = [];
  for (const raw of d.pieces as unknown[]) {
    if (typeof raw !== 'object' || raw === null) return null;
    const p = raw as Record<string, unknown>;
    if (!isInt(p.row, 0, rows - 1) || !isInt(p.col, 0, cols - 1)) return null;
    if (!isNum(p.x) || !isNum(p.y) || !isInt(p.rotation, 0, 3) || !isInt(p.group, 0)) return null;
    if (typeof p.locked !== 'boolean') return null;
    const cell = p.row * cols + p.col;
    if (seen.has(cell)) return null;
    seen.add(cell);
    pieces.push({ row: p.row, col: p.col, x: p.x, y: p.y, rotation: p.rotation, group: p.group, locked: p.locked });
  }
  return {
    version: SAVE_VERSION,
    seed: d.seed,
    rows,
    cols,
    pieceCount: d.pieceCount,
    rotate: d.rotate,
    elapsedMs: d.elapsedMs,
    moves: d.moves,
    pieces,
  };
}
