/**
 * The parts of a piece the snapping rules care about. (x, y) is the top-left
 * corner of the piece's cell box before rotation; the piece turns about the
 * box's center.
 */
export interface SnapPiece {
  row: number;
  col: number;
  x: number;
  y: number;
  /** Clockwise quarter turns, 0–3. Pieces in a group share one rotation. */
  rotation: number;
  /** Pieces sharing a group id are joined and move together. */
  group: number;
  /** Locked pieces sit in their correct spot on the board and can't be moved. */
  locked: boolean;
}

export interface SnapGeometry {
  cellW: number;
  cellH: number;
  /** Board top-left: where piece (0, 0) belongs. */
  boardX: number;
  boardY: number;
  /** Maximum distance (px) a group may be off its target and still snap. */
  tolerance: number;
}

export type SnapTarget = { kind: 'board' } | { kind: 'group'; group: number };

export interface Snap {
  dx: number;
  dy: number;
  target: SnapTarget;
}

const NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

const cellKey = (row: number, col: number) => `${row},${col}`;

/** Rotates a vector clockwise (on screen, where y points down) by `quarterTurns` × 90°. */
export function rotateVector(x: number, y: number, quarterTurns: number): [number, number] {
  switch (((quarterTurns % 4) + 4) % 4) {
    case 1:
      return [-y, x];
    case 2:
      return [-x, -y];
    case 3:
      return [y, -x];
    default:
      return [x, y];
  }
}

/**
 * Finds the closest snap for `group` within tolerance: either onto its correct
 * board position (only when upright), or onto an edge-adjacent piece from
 * another group with the same rotation.
 */
export function findSnap(pieces: readonly SnapPiece[], group: number, geo: SnapGeometry): Snap | null {
  const members = pieces.filter((p) => p.group === group);
  if (members.length === 0) return null;
  const byCell = new Map(pieces.map((p) => [cellKey(p.row, p.col), p]));

  let best: Snap | null = null;
  let bestDist = geo.tolerance;
  const consider = (dx: number, dy: number, target: SnapTarget) => {
    const dist = Math.hypot(dx, dy);
    if (dist <= bestDist) {
      bestDist = dist;
      best = { dx, dy, target };
    }
  };

  // Every member shares one offset from its board position, so checking one is enough.
  const m0 = members[0];
  if (m0.rotation === 0) {
    consider(geo.boardX + m0.col * geo.cellW - m0.x, geo.boardY + m0.row * geo.cellH - m0.y, {
      kind: 'board',
    });
  }

  for (const m of members) {
    for (const [dr, dc] of NEIGHBORS) {
      const n = byCell.get(cellKey(m.row + dr, m.col + dc));
      if (!n || n.group === group || n.rotation !== m.rotation) continue;
      // Where n's box should sit relative to m's, turned with the pieces.
      const [ox, oy] = rotateVector(dc * geo.cellW, dr * geo.cellH, m.rotation);
      consider(n.x - ox - m.x, n.y - oy - m.y, { kind: 'group', group: n.group });
    }
  }
  return best;
}

/**
 * Moves `group` by the snap offset and joins it to its target. Returns the id
 * of the resulting group. Joining a locked group locks the newcomers too.
 */
export function applySnap(pieces: SnapPiece[], group: number, snap: Snap): number {
  const members = pieces.filter((p) => p.group === group);
  for (const p of members) {
    p.x += snap.dx;
    p.y += snap.dy;
  }
  if (snap.target.kind === 'board') {
    for (const p of members) p.locked = true;
    return group;
  }
  const target = snap.target.group;
  const locked = pieces.some((p) => p.group === target && p.locked);
  for (const p of members) {
    p.group = target;
    p.locked = locked;
  }
  return target;
}

/**
 * Applies snaps repeatedly until none apply, since joining one neighbor can
 * bring the group within reach of others. Returns the final group id and
 * whether anything snapped.
 */
export function settle(
  pieces: SnapPiece[],
  group: number,
  geo: SnapGeometry,
): { group: number; snapped: boolean } {
  let snapped = false;
  for (let i = 0; i < pieces.length; i++) {
    if (pieces.some((p) => p.group === group && p.locked)) break;
    const snap = findSnap(pieces, group, geo);
    if (!snap) break;
    group = applySnap(pieces, group, snap);
    snapped = true;
  }
  return { group, snapped };
}

/**
 * Turns `group` a quarter turn clockwise about the point (px, py). Each piece
 * spins about its own center, and the centers orbit the pivot.
 */
export function rotateGroup(
  pieces: SnapPiece[],
  group: number,
  px: number,
  py: number,
  cellW: number,
  cellH: number,
): void {
  for (const p of pieces) {
    if (p.group !== group) continue;
    const [cx, cy] = rotateVector(p.x + cellW / 2 - px, p.y + cellH / 2 - py, 1);
    p.x = px + cx - cellW / 2;
    p.y = py + cy - cellH / 2;
    p.rotation = (p.rotation + 1) % 4;
  }
}

/**
 * Solved when every piece is locked to the board, or all pieces form a single
 * upright group.
 */
export function isSolved(pieces: readonly SnapPiece[]): boolean {
  if (pieces.length === 0) return false;
  if (pieces.every((p) => p.locked)) return true;
  return pieces.every((p) => p.group === pieces[0].group && p.rotation === 0);
}
