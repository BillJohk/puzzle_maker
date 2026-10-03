import {
  chooseArea,
  groupBounds,
  isEdgePiece,
  overlaps,
  packInArea,
  randomSpot,
  stripsAround,
  type Area,
} from './puzzle/arrange';
import { chooseGrid, type Grid } from './puzzle/grid';
import { mulberry32 } from './puzzle/rng';
import { fromSaved, toSaved, type SavedPuzzle } from './puzzle/save';
import { createLayout, pieceSides, piecePadding, tracePiece, type PuzzleLayout } from './puzzle/shape';
import { isSolved, rotateGroup, rotateVector, settle, type SnapGeometry, type SnapPiece } from './puzzle/snap';
import {
  clampView,
  IDENTITY_VIEW,
  MAX_ZOOM,
  panBy,
  pinchView,
  probePoints,
  toTable,
  zoomAt,
  type Point,
  type View,
} from './puzzle/view';

/** Position (x, y) is the canvas position (CSS px) of the piece's cell top-left corner. */
interface Piece extends SnapPiece {
  /** Outline in board coordinates. */
  path: Path2D;
  /** Pre-rendered image of the piece, including `pad` on every side. */
  sprite: HTMLCanvasElement;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Dragging the empty table to pan a zoomed view; positions are in screen pixels. */
interface Pan {
  pointerId: number;
  sx: number;
  sy: number;
}

/** A two-finger pinch: the fingers' ids and screen positions when it began. */
interface Pinch {
  ids: [number, number];
  start: View;
  a0: Point;
  b0: Point;
}

interface Drag {
  /** The piece under the pointer; the rest of its group follows it. */
  piece: Piece;
  members: Piece[];
  pointerId: number;
  dx: number;
  dy: number;
  /** Latest pointer position, the pivot for rotating mid-drag. */
  px: number;
  py: number;
  moved: boolean;
}

export interface GenerateOptions {
  /** Start pieces at random quarter turns and let the player rotate them. */
  rotate?: boolean;
  seed?: number;
  /** Use this grid instead of fitting one to `pieceCount` (when restoring a save). */
  grid?: Grid;
}

/** Glide of the finished picture onto the board when it was solved elsewhere on the table. */
interface FinishGlide {
  members: Piece[];
  from: [number, number][];
  dx: number;
  dy: number;
  start: number;
}

/** Fraction of the play area the assembled puzzle may occupy; the rest holds scattered pieces. */
const BOARD_MAX_W = 0.6;
const BOARD_MAX_H = 0.7;
/** How long the table size must hold still before the board is re-fitted to it. */
const REFIT_DELAY_MS = 250;
/** Snap distance as a fraction of the cell's short side. */
const SNAP_TOLERANCE = 0.25;
const GLIDE_MS = 700;
const REVEAL_MS = 400;
const SHINE_MS = 1400;
const FLASH_MS = 450;
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_SLOP = 20;
const GHOST_ALPHA = 0.25;
/** Most pixels spent on piece sprites, so zoomed-in pieces stay sharp without exhausting memory. */
const SPRITE_PIXEL_BUDGET = 16_000_000;
const WHEEL_ZOOM_SPEED = 0.0015;
/** How far (screen px) a finger or pen may miss a piece and still pick it up. */
const TOUCH_REACH = 22;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export class PuzzleGame {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hitCtx: CanvasRenderingContext2D;
  private image: ImageBitmap | null = null;
  /** The image at board size, used for the clean solved picture. */
  private scaled: HTMLCanvasElement | null = null;
  private pieces: Piece[] = [];
  private layout: PuzzleLayout | null = null;
  private board: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private pad = 0;
  private drag: Drag | null = null;
  private width = 0;
  private height = 0;
  /** Table size the board was laid out for; a new size re-fits it (e.g. a phone turning). */
  private laidOutFor = { w: 0, h: 0 };
  private refitTimer = 0;
  private dpr = 1;
  /** Sprite pixels per CSS pixel: the device ratio, raised so pieces stay sharp when zoomed. */
  private res = 1;
  private view: View = IDENTITY_VIEW;
  private pan: Pan | null = null;
  private pinch: Pinch | null = null;
  /** Screen positions of fingers and pens currently on the table. */
  private touches = new Map<number, Point>();
  private frame = 0;
  private seed = 0;
  private pieceCount = 0;

  private timerStart: number | null = null;
  private timerAccum = 0;
  private moveCount = 0;
  private solvedState = false;
  private glide: FinishGlide | null = null;
  private rotationEnabled = false;
  private lastTap: { group: number; time: number; x: number; y: number } | null = null;
  /** Pieces that just snapped, highlighted briefly. */
  private flash: { members: Piece[]; start: number } | null = null;
  /** When the solved picture was revealed (performance.now()), for the shine animation. */
  private revealedAt: number | null = null;
  private ghost = false;
  private lightTable = false;

  /** Called once when the puzzle is complete and the finished picture is shown. */
  onSolved: (() => void) | null = null;
  /** Called after each move or turn, so the UI can refresh its counters and save. */
  onProgress: (() => void) | null = null;
  /** Called when a drop snaps pieces together ('join') or onto the board ('lock'). */
  onSnap: ((kind: 'join' | 'lock') => void) | null = null;
  /** Called when a piece or group is picked up. */
  onPickUp: (() => void) | null = null;
  /** Called when the zoom level changes. */
  onViewChange: (() => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.hitCtx = document.createElement('canvas').getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    this.resize();
  }

  get hasImage(): boolean {
    return this.image !== null;
  }

  /** Play time so far; the clock starts on the first grab and stops when solved. */
  get elapsedMs(): number {
    return this.timerAccum + (this.timerStart === null ? 0 : performance.now() - this.timerStart);
  }

  get moves(): number {
    return this.moveCount;
  }

  get solved(): boolean {
    return this.solvedState;
  }

  get zoom(): number {
    return this.view.zoom;
  }

  /** Zooms about the middle of the screen. */
  zoomBy(factor: number): void {
    this.setView(zoomAt(this.view, factor, this.width / 2, this.height / 2, this.tableSize()));
  }

  resetView(): void {
    this.setView(IDENTITY_VIEW);
  }

  private setView(view: View): void {
    const changed = view.zoom !== this.view.zoom;
    this.view = view;
    this.requestDraw();
    if (changed) this.onViewChange?.();
  }

  private tableSize() {
    return { w: this.width, h: this.height };
  }

  /** On a light table the board is outlined in dark instead of light. */
  set onLightTable(light: boolean) {
    this.lightTable = light;
    this.requestDraw();
  }

  /** Shows a faint copy of the picture on the board, under the pieces. */
  set showGhost(on: boolean) {
    this.ghost = on;
    this.requestDraw();
  }

  setImage(image: ImageBitmap): void {
    this.image?.close();
    this.image = image;
  }

  /** Cuts the current image into roughly `pieceCount` pieces and scatters them. */
  generate(pieceCount: number, { rotate = false, seed = Date.now(), grid }: GenerateOptions = {}): Grid {
    const image = this.image;
    if (!image) throw new Error('No image loaded');
    seed >>>= 0;
    this.seed = seed;
    this.pieceCount = pieceCount;
    this.drag = null;
    this.lastTap = null;
    this.rotationEnabled = rotate;
    this.glide = null;
    this.flash = null;
    this.revealedAt = null;
    this.solvedState = false;
    this.timerStart = null;
    this.timerAccum = 0;
    this.moveCount = 0;

    const scale = Math.min(
      (this.width * BOARD_MAX_W) / image.width,
      (this.height * BOARD_MAX_H) / image.height,
    );
    const boardW = image.width * scale;
    const boardH = image.height * scale;
    this.laidOutFor = { w: this.width, h: this.height };
    this.board = {
      x: (this.width - boardW) / 2,
      y: (this.height - boardH) / 2,
      w: boardW,
      h: boardH,
    };

    const { rows, cols } = grid ?? chooseGrid(pieceCount, image.width / image.height);
    const rand = mulberry32(seed);
    const layout = createLayout(rows, cols, boardW / cols, boardH / rows, rand);
    this.layout = layout;
    this.pad = piecePadding(layout);
    this.pan = null;
    this.setView(IDENTITY_VIEW);

    // Render sprites sharper than the screen needs so zooming in stays crisp, within a
    // memory budget and never beyond the detail the source image has.
    const spritePixels = rows * cols * (layout.cellW + 2 * this.pad) * (layout.cellH + 2 * this.pad) * this.dpr ** 2;
    const detail = Math.min(Math.sqrt(SPRITE_PIXEL_BUDGET / spritePixels), image.width / (boardW * this.dpr), MAX_ZOOM);
    this.res = this.dpr * Math.max(1, detail);

    // Scale the source image once so large photos aren't resampled for every piece.
    const scaled = document.createElement('canvas');
    scaled.width = Math.ceil(boardW * this.res);
    scaled.height = Math.ceil(boardH * this.res);
    scaled.getContext('2d')!.drawImage(image, 0, 0, scaled.width, scaled.height);
    this.scaled = scaled;

    const pieces: Piece[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const path = new Path2D();
        tracePiece(pieceSides(layout, r, c), path);
        const { x, y } = this.scatterPosition(rand);
        const sprite = this.renderSprite(scaled, path, r, c);
        const rotation = rotate ? Math.floor(rand() * 4) : 0;
        pieces.push({ row: r, col: c, x, y, rotation, group: r * cols + c, locked: false, path, sprite });
      }
    }
    // Shuffle the stacking order so neighbors aren't layered predictably.
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    this.pieces = pieces;
    this.requestDraw();
    return { rows, cols };
  }

  /** The current puzzle, ready to store; null when there is nothing worth resuming. */
  snapshot(): SavedPuzzle | null {
    if (!this.layout || this.solvedState) return null;
    const { rows, cols } = this.layout;
    return toSaved(
      this.pieces,
      {
        seed: this.seed,
        rows,
        cols,
        pieceCount: this.pieceCount,
        rotate: this.rotationEnabled,
        elapsedMs: this.elapsedMs,
        moves: this.moveCount,
      },
      this.boardFrame(),
    );
  }

  /** Re-cuts the saved puzzle from the current image and puts every piece back where it was. */
  restore(saved: SavedPuzzle): Grid {
    const grid = this.generate(saved.pieceCount, {
      rotate: saved.rotate,
      seed: saved.seed,
      grid: { rows: saved.rows, cols: saved.cols },
    });
    const byCell = new Map(this.pieces.map((p) => [`${p.row},${p.col}`, p]));
    this.pieces = fromSaved(saved, this.boardFrame()).map((s) => Object.assign(byCell.get(`${s.row},${s.col}`)!, s));
    this.timerAccum = saved.elapsedMs;
    this.moveCount = saved.moves;
    this.keepGroupsInView();
    this.requestDraw();
    return grid;
  }

  /**
   * Gathers the loose edge pieces (ones not yet joined to anything) into the
   * roomiest strip of table beside the board, moving loose inner pieces out
   * of that strip. Returns how many edge pieces were moved.
   */
  gatherEdges(): number {
    if (!this.layout || this.solvedState || this.drag || this.glide) return 0;
    const { rows, cols, cellW, cellH } = this.layout;
    const groupSize = new Map<number, number>();
    for (const p of this.pieces) groupSize.set(p.group, (groupSize.get(p.group) ?? 0) + 1);
    const edges = this.pieces.filter(
      (p) => !p.locked && groupSize.get(p.group) === 1 && isEdgePiece(p.row, p.col, rows, cols),
    );
    if (edges.length === 0) return 0;

    // Turned pieces on non-square cells are taller than wide, so leave room either way.
    const span = this.rotationEnabled ? Math.max(cellW, cellH) : 0;
    const item = { w: (span || cellW) + 2 * this.pad, h: (span || cellH) + 2 * this.pad };
    const area = chooseArea(stripsAround({ w: this.width, h: this.height }, this.board), edges.length, item);
    const rand = Math.random;
    for (const p of this.pieces) {
      if (p.locked || groupSize.get(p.group) !== 1 || isEdgePiece(p.row, p.col, rows, cols)) continue;
      if (overlaps({ x: p.x, y: p.y, w: cellW, h: cellH }, area)) Object.assign(p, this.scatterPosition(rand, [area]));
    }
    packInArea(edges.length, area, item).forEach((pos, i) => {
      const [x, y] = this.clampToView(pos.x + (item.w - cellW) / 2, pos.y + (item.h - cellH) / 2);
      edges[i].x = x;
      edges[i].y = y;
    });
    // Gathered pieces go on top so none hide under the rest.
    const gathered = new Set(edges);
    this.pieces = [...this.pieces.filter((p) => !gathered.has(p)), ...edges];
    this.lastTap = null;
    this.requestDraw();
    this.onProgress?.();
    return edges.length;
  }

  /**
   * Scatters every loose piece and group to a fresh random spot off the board,
   * keeping groups together. Doesn't count as a move or start the clock.
   */
  shuffle(): void {
    if (!this.layout || this.solvedState || this.drag || this.glide) return;
    const { cellW, cellH } = this.layout;
    const groups = new Map<number, Piece[]>();
    for (const p of this.pieces) {
      if (p.locked) continue;
      const g = groups.get(p.group);
      if (g) g.push(p);
      else groups.set(p.group, [p]);
    }
    const rand = Math.random;
    const order = [...groups.values()];
    for (const members of order) {
      const box = groupBounds(members, cellW, cellH);
      const spot = randomSpot(this.tableSize(), box, this.pad, [this.board], rand);
      this.moveGroup(members, spot.x - box.x, spot.y - box.y);
    }
    // Restack the loose groups in a new random order, each kept together.
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.pieces = [...this.pieces.filter((p) => p.locked), ...order.flat()];
    this.keepGroupsInView();
    this.lastTap = null;
    this.requestDraw();
    this.onProgress?.();
  }

  private boardFrame() {
    const { cellW, cellH } = this.layout!;
    return { boardX: this.board.x, boardY: this.board.y, cellW, cellH };
  }

  private renderSprite(scaled: HTMLCanvasElement, path: Path2D, r: number, c: number): HTMLCanvasElement {
    const { cellW, cellH } = this.layout!;
    const pad = this.pad;
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil((cellW + 2 * pad) * this.res);
    sprite.height = Math.ceil((cellH + 2 * pad) * this.res);
    const ctx = sprite.getContext('2d')!;
    ctx.scale(this.res, this.res);
    ctx.translate(pad - c * cellW, pad - r * cellH);
    ctx.save();
    ctx.clip(path);
    ctx.drawImage(scaled, 0, 0, this.board.w, this.board.h);
    ctx.restore();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.stroke(path);
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.stroke(path);
    return sprite;
  }

  /** Random cell position, preferring spots that don't cover the board (or the other areas given). */
  private scatterPosition(rand: () => number, avoid: Area[] = []): { x: number; y: number } {
    const { cellW, cellH } = this.layout!;
    return randomSpot(this.tableSize(), { w: cellW, h: cellH }, this.pad, [this.board, ...avoid], rand);
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    // Keep every group grabbable if the window shrank.
    this.keepGroupsInView();
    this.view = clampView(this.view, this.tableSize());
    this.draw();
    const { w, h } = this.laidOutFor;
    if (this.layout && (Math.abs(this.width - w) > 1 || Math.abs(this.height - h) > 1)) {
      window.clearTimeout(this.refitTimer);
      this.refitTimer = window.setTimeout(this.refit, REFIT_DELAY_MS);
    }
  }

  /**
   * Lays the board out again for the current table size, keeping every piece
   * where it was relative to the board, the clock and the move count.
   */
  private refit = (): void => {
    // Wait until the player lets go; a finished puzzle stays as it is.
    if (this.drag || this.pan || this.pinch || this.touches.size > 0) {
      this.refitTimer = window.setTimeout(this.refit, REFIT_DELAY_MS);
      return;
    }
    const saved = this.snapshot();
    if (!saved || this.glide) return;
    const running = this.timerStart !== null;
    this.restore(saved);
    if (running) this.timerStart = performance.now();
    this.onProgress?.();
  };

  private keepGroupsInView(): void {
    if (!this.layout) return;
    const seen = new Set<number>();
    for (const p of this.pieces) {
      if (p.locked || seen.has(p.group)) continue;
      seen.add(p.group);
      const members = this.pieces.filter((m) => m.group === p.group);
      const [x, y] = this.clampToView(p.x, p.y);
      this.moveGroup(members, x - p.x, y - p.y);
    }
  }

  /** Clamps a proposed piece position so at least half of the piece stays on screen. */
  private clampToView(x: number, y: number): [number, number] {
    const { cellW, cellH } = this.layout!;
    return [
      Math.min(Math.max(x, -cellW / 2), this.width - cellW / 2),
      Math.min(Math.max(y, -cellH / 2), this.height - cellH / 2),
    ];
  }

  private moveGroup(members: Piece[], dx: number, dy: number): void {
    for (const m of members) {
      m.x += dx;
      m.y += dy;
    }
  }

  private snapGeometry(): SnapGeometry {
    const { cellW, cellH } = this.layout!;
    return {
      cellW,
      cellH,
      boardX: this.board.x,
      boardY: this.board.y,
      tolerance: Math.max(8, SNAP_TOLERANCE * Math.min(cellW, cellH)),
    };
  }

  private requestDraw(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private draw(): void {
    const now = performance.now();
    this.stepGlide(now);
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.layout) return;
    this.applyView();

    const b = this.board;
    ctx.fillStyle = this.lightTable ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = this.lightTable ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    ctx.setLineDash([]);
    if (this.ghost && this.revealedAt === null) {
      ctx.save();
      ctx.globalAlpha = GHOST_ALPHA;
      ctx.drawImage(this.scaled!, b.x, b.y, b.w, b.h);
      ctx.restore();
    }

    const { cellW, cellH } = this.layout;
    const pad = this.pad;
    const drawPiece = (p: Piece) => {
      if (p.rotation === 0) {
        ctx.drawImage(p.sprite, p.x - pad, p.y - pad, cellW + 2 * pad, cellH + 2 * pad);
        return;
      }
      ctx.save();
      ctx.translate(p.x + cellW / 2, p.y + cellH / 2);
      ctx.rotate((p.rotation * Math.PI) / 2);
      ctx.drawImage(p.sprite, -cellW / 2 - pad, -cellH / 2 - pad, cellW + 2 * pad, cellH + 2 * pad);
      ctx.restore();
    };
    const dragged = new Set(this.drag?.members);
    for (const p of this.pieces) if (!dragged.has(p)) drawPiece(p);

    // Dragged group (always on top): shadow pass first, then a clean pass so
    // one member's shadow never darkens another.
    if (dragged.size > 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      dragged.forEach(drawPiece);
      ctx.restore();
      dragged.forEach(drawPiece);
    }

    if (this.flash) this.drawFlash(now - this.flash.start);
    if (this.revealedAt !== null) this.drawReveal(now - this.revealedAt);
    if (this.glide || this.flash || (this.revealedAt !== null && now - this.revealedAt < SHINE_MS)) {
      this.requestDraw();
    }
  }

  /** Sets the canvas transform so drawing in table coordinates lands on screen through the view. */
  private applyView(): void {
    const { zoom, x, y } = this.view;
    const k = this.dpr * zoom;
    this.ctx.setTransform(k, 0, 0, k, -x * k, -y * k);
  }

  /** Fading glow around the outlines of pieces that just snapped. */
  private drawFlash(t: number): void {
    if (t >= FLASH_MS) {
      this.flash = null;
      return;
    }
    const ctx = this.ctx;
    const { cellW, cellH } = this.layout!;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 244, 200, ${0.9 * (1 - t / FLASH_MS)})`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(255, 236, 160, 0.9)';
    ctx.shadowBlur = 10;
    for (const p of this.flash!.members) {
      // Board coordinates -> the piece's on-screen position and rotation.
      this.applyView();
      ctx.translate(p.x + cellW / 2, p.y + cellH / 2);
      ctx.rotate((p.rotation * Math.PI) / 2);
      ctx.translate(-(p.col + 0.5) * cellW, -(p.row + 0.5) * cellH);
      ctx.stroke(p.path);
    }
    ctx.restore();
  }

  /** Fades in the outline-free picture over the board, then sweeps a shine across it. */
  private drawReveal(t: number): void {
    const ctx = this.ctx;
    const b = this.board;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t / REVEAL_MS);
    ctx.drawImage(this.scaled!, b.x, b.y, b.w, b.h);
    ctx.restore();

    if (t >= SHINE_MS) return;
    const band = b.w * 0.25;
    const cx = b.x - band + (b.w + 2 * band) * easeInOut(t / SHINE_MS);
    const shine = ctx.createLinearGradient(cx - band / 2, 0, cx + band / 2, 0);
    shine.addColorStop(0, 'rgba(255, 255, 255, 0)');
    shine.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
    shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    ctx.clip();
    ctx.fillStyle = shine;
    ctx.fillRect(cx - band / 2, b.y, band, b.h);
    ctx.restore();
  }

  /** Stops the clock and shows the finished picture, gliding it onto the board first if needed. */
  private finish(): void {
    if (this.timerStart !== null) {
      this.timerAccum += performance.now() - this.timerStart;
      this.timerStart = null;
    }
    this.solvedState = true;
    const members = this.pieces.filter((p) => !p.locked);
    if (members.length === 0) {
      this.reveal();
      return;
    }
    // Everything is one group, so a single offset moves it into place.
    const { cellW, cellH } = this.layout!;
    const m0 = members[0];
    this.glide = {
      members,
      from: members.map((m) => [m.x, m.y]),
      dx: this.board.x + m0.col * cellW - m0.x,
      dy: this.board.y + m0.row * cellH - m0.y,
      start: performance.now(),
    };
  }

  private stepGlide(now: number): void {
    const g = this.glide;
    if (!g) return;
    const t = Math.min(1, (now - g.start) / GLIDE_MS);
    const k = easeInOut(t);
    g.members.forEach((m, i) => {
      m.x = g.from[i][0] + g.dx * k;
      m.y = g.from[i][1] + g.dy * k;
    });
    if (t === 1) {
      this.glide = null;
      for (const m of g.members) m.locked = true;
      this.reveal();
    }
  }

  private reveal(): void {
    this.revealedAt = performance.now();
    this.requestDraw();
    this.onSolved?.();
  }

  private screenPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** The event's position on the table (through the zoomed view). */
  private pointerPos(e: MouseEvent): { x: number; y: number } {
    const s = this.screenPos(e);
    const [x, y] = toTable(this.view, s.x, s.y);
    return { x, y };
  }

  /** Topmost piece whose actual outline (not just its box) contains the point. */
  /** Like pieceAt, but forgiving of a near miss within `reach` (table units). */
  private pieceNear(x: number, y: number, reach: number): Piece | null {
    for (const q of [{ x, y }, ...probePoints(x, y, reach)]) {
      const piece = this.pieceAt(q.x, q.y);
      if (piece) return piece;
    }
    return null;
  }

  /**
   * A second finger turns the gesture into a pinch, unless a piece is already
   * being dragged somewhere (then the extra finger is ignored).
   */
  private startPinch(e: PointerEvent): void {
    if (this.pinch || this.drag?.moved) return;
    const other = [...this.touches.keys()].find((id) => id !== e.pointerId);
    if (other === undefined) return;
    if (this.drag) {
      this.drag = null;
      this.canvas.classList.remove('dragging');
      this.requestDraw();
    }
    this.pan = null;
    this.canvas.classList.remove('panning');
    this.lastTap = null;
    this.pinch = {
      ids: [other, e.pointerId],
      start: this.view,
      a0: this.touches.get(other)!,
      b0: this.touches.get(e.pointerId)!,
    };
  }

  private pieceAt(x: number, y: number): Piece | null {
    const { cellW, cellH } = this.layout!;
    const pad = this.pad;
    const reach = Math.max(cellW, cellH) / 2 + pad;
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      if (p.locked) continue;
      const cx = p.x + cellW / 2;
      const cy = p.y + cellH / 2;
      if (Math.abs(x - cx) > reach || Math.abs(y - cy) > reach) continue;
      // Undo the piece's rotation to get back to board coordinates.
      const [ux, uy] = rotateVector(x - cx, y - cy, -p.rotation);
      const lx = (p.col + 0.5) * cellW + ux;
      const ly = (p.row + 0.5) * cellH + uy;
      if (this.hitCtx.isPointInPath(p.path, lx, ly)) return p;
    }
    return null;
  }

  /** Turns a group a quarter turn (clockwise unless `turns` is -1) about (px, py), keeping it on screen. */
  private rotateAt(group: number, px: number, py: number, turns: 1 | -1 = 1): void {
    const { cellW, cellH } = this.layout!;
    rotateGroup(this.pieces, group, px, py, cellW, cellH, turns);
    const members = this.pieces.filter((p) => p.group === group);
    const m0 = members[0];
    const [x, y] = this.clampToView(m0.x, m0.y);
    this.moveGroup(members, x - m0.x, y - m0.y);
    this.onPickUp?.();
    this.requestDraw();
  }

  /** Snaps a group after it moved or turned, then checks for a finished puzzle. */
  private settleGroup(piece: Piece, members: Piece[]): void {
    const { snapped } = settle(this.pieces, piece.group, this.snapGeometry());
    if (snapped) {
      this.flash = { members, start: performance.now() };
      this.onSnap?.(piece.locked ? 'lock' : 'join');
      // Locked pieces form the bottom layer so loose pieces always stay on top.
      this.pieces = [...this.pieces.filter((p) => p.locked), ...this.pieces.filter((p) => !p.locked)];
      if (isSolved(this.pieces)) this.finish();
    }
    this.requestDraw();
    this.onProgress?.();
  }

  /** Rotates a loose piece in place (right-click). */
  private rotatePieceAt(x: number, y: number): void {
    if (!this.layout || !this.rotationEnabled || this.solvedState || this.drag) return;
    const piece = this.pieceAt(x, y);
    if (!piece) return;
    this.timerStart ??= performance.now();
    this.rotateAt(piece.group, x, y);
    this.moveCount++;
    this.settleGroup(piece, this.pieces.filter((p) => p.group === piece.group));
  }

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    const { x, y } = this.pointerPos(e);
    this.rotatePieceAt(x, y);
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.layout) return;
    e.preventDefault();
    // Line-based deltas (some mice) are much coarser than pixel deltas.
    const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
    const { x, y } = this.screenPos(e);
    this.setView(zoomAt(this.view, Math.exp(-delta * WHEEL_ZOOM_SPEED), x, y, this.tableSize()));
  };

  /** R or Space while dragging turns the held group about the pointer; with Shift, counterclockwise. */
  private onKeyDown = (e: KeyboardEvent): void => {
    const d = this.drag;
    if (!d || !this.rotationEnabled || e.repeat) return;
    if (e.key !== 'r' && e.key !== 'R' && e.key !== ' ') return;
    e.preventDefault();
    this.rotateAt(d.piece.group, d.px, d.py, e.shiftKey ? -1 : 1);
    d.dx = d.px - d.piece.x;
    d.dy = d.py - d.piece.y;
    d.moved = true;
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.layout) return;
    if (e.pointerType !== 'mouse') {
      this.touches.set(e.pointerId, this.screenPos(e));
      // Capture every finger so its lift is seen even off the canvas.
      this.canvas.setPointerCapture(e.pointerId);
      if (this.touches.size >= 2) {
        this.startPinch(e);
        return;
      }
    }
    if (this.drag || this.pan || this.pinch) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { x, y } = this.pointerPos(e);
    const reach = e.pointerType === 'mouse' ? 0 : TOUCH_REACH / this.view.zoom;
    const piece = this.solvedState ? null : this.pieceNear(x, y, reach);
    if (!piece) {
      // Dragging the empty table moves a zoomed-in view around.
      if (this.view.zoom > 1) {
        const s = this.screenPos(e);
        this.pan = { pointerId: e.pointerId, sx: s.x, sy: s.y };
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.classList.add('panning');
      }
      return;
    }
    // Lift the whole group to the top, keeping its internal stacking order.
    const members = this.pieces.filter((p) => p.group === piece.group);
    this.pieces = [...this.pieces.filter((p) => p.group !== piece.group), ...members];
    this.drag = {
      piece,
      members,
      pointerId: e.pointerId,
      dx: x - piece.x,
      dy: y - piece.y,
      px: x,
      py: y,
      moved: false,
    };
    this.timerStart ??= performance.now();
    this.onPickUp?.();
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.classList.add('dragging');
    this.requestDraw();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, this.screenPos(e));
    const pinch = this.pinch;
    if (pinch?.ids.includes(e.pointerId)) {
      const a1 = this.touches.get(pinch.ids[0]);
      const b1 = this.touches.get(pinch.ids[1]);
      if (a1 && b1) this.setView(pinchView(pinch.start, pinch.a0, pinch.b0, a1, b1, this.tableSize()));
      return;
    }
    if (this.pan?.pointerId === e.pointerId) {
      const s = this.screenPos(e);
      this.setView(panBy(this.view, s.x - this.pan.sx, s.y - this.pan.sy, this.tableSize()));
      this.pan.sx = s.x;
      this.pan.sy = s.y;
      return;
    }
    if (this.drag?.pointerId !== e.pointerId) return;
    const { x, y } = this.pointerPos(e);
    this.drag.px = x;
    this.drag.py = y;
    const p = this.drag.piece;
    const [nx, ny] = this.clampToView(x - this.drag.dx, y - this.drag.dy);
    if (nx === p.x && ny === p.y) return;
    this.drag.moved = true;
    this.moveGroup(this.drag.members, nx - p.x, ny - p.y);
    this.requestDraw();
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.touches.delete(e.pointerId);
    if (this.pinch?.ids.includes(e.pointerId)) {
      // The other finger stays idle until lifted.
      this.pinch = null;
      return;
    }
    if (this.pan?.pointerId === e.pointerId) {
      this.pan = null;
      this.canvas.classList.remove('panning');
      return;
    }
    if (this.drag?.pointerId !== e.pointerId) return;
    const { piece, members, moved, px, py } = this.drag;
    this.drag = null;
    this.canvas.classList.remove('dragging');
    if (moved) {
      this.moveCount++;
      this.lastTap = null;
    } else if (this.rotationEnabled && e.type === 'pointerup') {
      // Two quick taps on the same piece rotate it (works for touch and mouse).
      const now = performance.now();
      const t = this.lastTap;
      if (
        t &&
        t.group === piece.group &&
        now - t.time < DOUBLE_TAP_MS &&
        Math.hypot(px - t.x, py - t.y) < DOUBLE_TAP_SLOP
      ) {
        this.lastTap = null;
        this.rotateAt(piece.group, px, py);
        this.moveCount++;
      } else {
        this.lastTap = { group: piece.group, time: now, x: px, y: py };
      }
    }
    this.settleGroup(piece, members);
  };
}
