/** The parts of a piece the snapping rules care about. Positions are cell top-left corners. */
export interface SnapPiece {
  row: number;
  col: number;
  x: number;
  y: number;
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

/**
 * Finds the closest snap for `group` within tolerance: either onto its correct
 * board position, or onto an edge-adjacent piece from another group.
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
  consider(geo.boardX + m0.col * geo.cellW - m0.x, geo.boardY + m0.row * geo.cellH - m0.y, {
    kind: 'board',
  });

  for (const m of members) {
    for (const [dr, dc] of NEIGHBORS) {
      const n = byCell.get(cellKey(m.row + dr, m.col + dc));
      if (!n || n.group === group) continue;
      consider(n.x - dc * geo.cellW - m.x, n.y - dr * geo.cellH - m.y, {
        kind: 'group',
        group: n.group,
      });
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

/** Solved when every piece is locked to the board or all pieces form a single group. */
export function isSolved(pieces: readonly SnapPiece[]): boolean {
  if (pieces.length === 0) return false;
  return pieces.every((p) => p.locked) || pieces.every((p) => p.group === pieces[0].group);
}
