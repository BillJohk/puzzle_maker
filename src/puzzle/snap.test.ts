import { describe, expect, it } from 'vitest';
import {
  applySnap,
  findSnap,
  isSolved,
  rotateGroup,
  rotateVector,
  settle,
  type SnapGeometry,
  type SnapPiece,
} from './snap';

const geo: SnapGeometry = { cellW: 100, cellH: 80, boardX: 1000, boardY: 1000, tolerance: 20 };

function piece(row: number, col: number, x: number, y: number, group: number, rotation = 0): SnapPiece {
  return { row, col, x, y, group, locked: false, rotation };
}

describe('findSnap', () => {
  it('snaps a piece onto a nearby edge neighbor', () => {
    const pieces = [piece(0, 0, 200, 200, 0), piece(0, 1, 305, 196, 1)];
    expect(findSnap(pieces, 1, geo)).toEqual({ dx: -5, dy: 4, target: { kind: 'group', group: 0 } });
  });

  it('ignores neighbors outside the tolerance', () => {
    const pieces = [piece(0, 0, 200, 200, 0), piece(0, 1, 330, 200, 1)];
    expect(findSnap(pieces, 1, geo)).toBeNull();
  });

  it('ignores pieces that are not edge-adjacent in the picture', () => {
    // (1, 1) is diagonal to (0, 0); (0, 2) is two columns away.
    const pieces = [piece(0, 0, 200, 200, 0), piece(1, 1, 300, 280, 1), piece(0, 2, 400, 200, 2)];
    expect(findSnap(pieces, 1, geo)).toBeNull();
    expect(findSnap(pieces, 2, geo)).toBeNull();
  });

  it('snaps onto the board near the correct spot', () => {
    const pieces = [piece(1, 2, 1000 + 200 + 6, 1000 + 80 - 8, 0)];
    expect(findSnap(pieces, 0, geo)).toEqual({ dx: -6, dy: 8, target: { kind: 'board' } });
  });

  it('checks every member of a group against its neighbors', () => {
    const pieces = [
      piece(0, 0, 200, 200, 0),
      piece(0, 1, 300, 200, 0),
      piece(1, 1, 302, 283, 1), // below (0, 1), not (0, 0)
    ];
    expect(findSnap(pieces, 1, geo)).toEqual({ dx: -2, dy: -3, target: { kind: 'group', group: 0 } });
  });

  it('picks the closest of several candidates', () => {
    const pieces = [piece(0, 0, 200, 200, 0), piece(0, 2, 415, 200, 2), piece(0, 1, 305, 200, 1)];
    expect(findSnap(pieces, 1, geo)?.target).toEqual({ kind: 'group', group: 0 });
  });
});

describe('applySnap', () => {
  it('moves the whole group and merges it into the target', () => {
    const pieces = [piece(0, 0, 200, 200, 0), piece(0, 1, 305, 196, 1), piece(1, 1, 305, 276, 1)];
    const group = applySnap(pieces, 1, { dx: -5, dy: 4, target: { kind: 'group', group: 0 } });
    expect(group).toBe(0);
    expect(pieces.map((p) => [p.x, p.y, p.group])).toEqual([
      [200, 200, 0],
      [300, 200, 0],
      [300, 280, 0],
    ]);
  });

  it('locks a group snapped to the board', () => {
    const pieces = [piece(0, 0, 1003, 1002, 0), piece(0, 1, 1103, 1002, 0)];
    applySnap(pieces, 0, { dx: -3, dy: -2, target: { kind: 'board' } });
    expect(pieces.every((p) => p.locked)).toBe(true);
  });

  it('locks pieces that join a locked group', () => {
    const pieces = [piece(0, 0, 1000, 1000, 0), piece(0, 1, 1104, 1000, 1)];
    pieces[0].locked = true;
    applySnap(pieces, 1, { dx: -4, dy: 0, target: { kind: 'group', group: 0 } });
    expect(pieces[1].locked).toBe(true);
  });
});

describe('settle', () => {
  it('keeps snapping while new neighbors come within reach', () => {
    // Dropping (0, 1) between (0, 0) and (0, 2) joins both.
    const pieces = [piece(0, 0, 200, 200, 0), piece(0, 2, 400, 200, 2), piece(0, 1, 303, 200, 1)];
    const result = settle(pieces, 1, geo);
    expect(result.snapped).toBe(true);
    expect(new Set(pieces.map((p) => p.group)).size).toBe(1);
    expect(pieces.map((p) => p.x)).toEqual([200, 400, 300]);
  });

  it('reports when nothing snapped', () => {
    const pieces = [piece(0, 0, 200, 200, 0), piece(0, 1, 500, 500, 1)];
    expect(settle(pieces, 1, geo)).toEqual({ group: 1, snapped: false });
  });
});

describe('rotation', () => {
  it('rotates vectors clockwise on screen', () => {
    expect(rotateVector(1, 0, 1)).toEqual([-0, 1]);
    expect(rotateVector(1, 0, 2)).toEqual([-1, -0]);
    expect(rotateVector(1, 0, 3)).toEqual([0, -1]);
    expect(rotateVector(1, 0, 4)).toEqual([1, 0]);
    expect(rotateVector(1, 0, -1)).toEqual([0, -1]);
  });

  it('only snaps neighbors with the same rotation', () => {
    const pieces = [piece(0, 0, 200, 200, 0, 1), piece(0, 1, 300, 200, 1, 0)];
    expect(findSnap(pieces, 1, geo)).toBeNull();
  });

  it('expects a rotated neighbor in the rotated direction', () => {
    // Turned a quarter clockwise, the piece to the right of (0, 0) sits below it.
    const pieces = [piece(0, 0, 200, 200, 0, 1), piece(0, 1, 203, 298, 1, 1)];
    expect(findSnap(pieces, 1, geo)).toEqual({ dx: -3, dy: 2, target: { kind: 'group', group: 0 } });
  });

  it('does not lock a rotated piece onto the board', () => {
    const pieces = [piece(0, 0, 1000, 1000, 0, 2)];
    expect(findSnap(pieces, 0, geo)).toBeNull();
  });

  it('turns a group about a pivot, keeping it assembled', () => {
    const pieces = [piece(0, 0, 200, 200, 0), piece(0, 1, 300, 200, 0)];
    // Pivot on the center of (0, 0): it spins in place and (0, 1) swings below it.
    rotateGroup(pieces, 0, 250, 240, 100, 80);
    expect(pieces.map((p) => [p.x, p.y, p.rotation])).toEqual([
      [200, 200, 1],
      [200, 300, 1],
    ]);
    // Still a valid pair for the snapping rules: nothing to correct.
    const geoSameCells = { ...geo, cellW: 100, cellH: 80 };
    pieces[1].group = 1;
    expect(findSnap(pieces, 1, geoSameCells)).toEqual({ dx: 0, dy: 0, target: { kind: 'group', group: 0 } });
  });

  it('returns to the start after four turns', () => {
    const pieces = [piece(0, 0, 200, 200, 0), piece(1, 0, 200, 280, 0)];
    for (let i = 0; i < 4; i++) rotateGroup(pieces, 0, 237, 251, 100, 80);
    expect(pieces[0].x).toBeCloseTo(200);
    expect(pieces[0].y).toBeCloseTo(200);
    expect(pieces[1].x).toBeCloseTo(200);
    expect(pieces[1].y).toBeCloseTo(280);
    expect(pieces.every((p) => p.rotation === 0)).toBe(true);
  });

  it('turns counterclockwise, undoing a clockwise turn', () => {
    const pieces = [piece(0, 0, 200, 200, 0), piece(0, 1, 300, 200, 0)];
    rotateGroup(pieces, 0, 250, 240, 100, 80, -1);
    expect(pieces.map((p) => [p.x, p.y, p.rotation])).toEqual([
      [200, 200, 3],
      [200, 100, 3],
    ]);
    rotateGroup(pieces, 0, 250, 240, 100, 80);
    expect(pieces[1].x).toBeCloseTo(300);
    expect(pieces[1].y).toBeCloseTo(200);
    expect(pieces.every((p) => p.rotation === 0)).toBe(true);
  });
});

describe('isSolved', () => {
  it('is not solved while the single group is rotated', () => {
    expect(isSolved([piece(0, 0, 0, 0, 3, 2), piece(0, 1, -100, 0, 3, 2)])).toBe(false);
  });

  it('is solved when every piece is locked', () => {
    const pieces = [piece(0, 0, 1000, 1000, 0), piece(0, 1, 1100, 1000, 1)];
    expect(isSolved(pieces)).toBe(false);
    pieces.forEach((p) => (p.locked = true));
    expect(isSolved(pieces)).toBe(true);
  });

  it('is solved when all pieces form one group, even off the board', () => {
    expect(isSolved([piece(0, 0, 0, 0, 3), piece(0, 1, 100, 0, 3)])).toBe(true);
  });
});
