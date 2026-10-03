export const PIECE_COUNT_OPTIONS = [12, 24, 48, 100, 150, 200, 300] as const;

export interface Grid {
  rows: number;
  cols: number;
}

/**
 * Picks a rows × cols grid close to `pieceCount` whose cells are roughly square
 * for an image with the given aspect ratio (width / height). The actual piece
 * count (rows * cols) will often differ slightly from the request.
 */
export function chooseGrid(pieceCount: number, aspect: number): Grid {
  const n = Math.max(1, Math.round(pieceCount));
  const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
  const rows = Math.max(1, Math.round(n / cols));
  return { rows, cols };
}
