/**
 * Custom piece counts are allowed from 4 up to 500. Above the 300 of the
 * fixed choices, pieces get small on most screens, but zoom keeps them
 * playable and the sprite pixel budget bounds memory.
 */
export const MIN_PIECES = 4;
export const MAX_PIECES = 500;

export interface Preset {
  id: string;
  label: string;
  pieces: number;
  rotate: boolean;
}

export const PRESETS: readonly Preset[] = [
  { id: 'easy', label: 'Easy', pieces: 24, rotate: false },
  { id: 'medium', label: 'Medium', pieces: 48, rotate: false },
  { id: 'hard', label: 'Hard', pieces: 150, rotate: true },
  { id: 'expert', label: 'Expert', pieces: 300, rotate: true },
];

/** The preset with exactly these settings, if any. */
export function presetFor(pieces: number, rotate: boolean): Preset | null {
  return PRESETS.find((p) => p.pieces === pieces && p.rotate === rotate) ?? null;
}

/**
 * Reads a typed piece count, rounding and clamping it into range. Returns
 * null when the text isn't a number at all.
 */
export function parsePieceCount(text: string): number | null {
  const n = Number(text.trim());
  if (text.trim() === '' || !Number.isFinite(n)) return null;
  return Math.min(MAX_PIECES, Math.max(MIN_PIECES, Math.round(n)));
}
