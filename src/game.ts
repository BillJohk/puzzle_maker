import { chooseGrid, type Grid } from './puzzle/grid';
import { mulberry32 } from './puzzle/rng';
import { createLayout, pieceSides, piecePadding, tracePiece, type PuzzleLayout } from './puzzle/shape';
import { isSolved, settle, type SnapGeometry, type SnapPiece } from './puzzle/snap';

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

interface Drag {
  /** The piece under the pointer; the rest of its group follows it. */
  piece: Piece;
  members: Piece[];
  pointerId: number;
  dx: number;
  dy: number;
}

/** Fraction of the play area the assembled puzzle may occupy; the rest holds scattered pieces. */
const BOARD_MAX_W = 0.6;
const BOARD_MAX_H = 0.7;
/** Snap distance as a fraction of the cell's short side. */
const SNAP_TOLERANCE = 0.25;

export class PuzzleGame {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hitCtx: CanvasRenderingContext2D;
  private image: ImageBitmap | null = null;
  private pieces: Piece[] = [];
  private layout: PuzzleLayout | null = null;
  private board: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private pad = 0;
  private drag: Drag | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private frame = 0;

  /** Called once when the last piece snaps into place. */
  onSolved: (() => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.hitCtx = document.createElement('canvas').getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    this.resize();
  }

  get hasImage(): boolean {
    return this.image !== null;
  }

  setImage(image: ImageBitmap): void {
    this.image?.close();
    this.image = image;
  }

  /** Cuts the current image into roughly `pieceCount` pieces and scatters them. */
  generate(pieceCount: number, seed = Date.now()): Grid {
    const image = this.image;
    if (!image) throw new Error('No image loaded');
    this.drag = null;

    const scale = Math.min(
      (this.width * BOARD_MAX_W) / image.width,
      (this.height * BOARD_MAX_H) / image.height,
    );
    const boardW = image.width * scale;
    const boardH = image.height * scale;
    this.board = {
      x: (this.width - boardW) / 2,
      y: (this.height - boardH) / 2,
      w: boardW,
      h: boardH,
    };

    const { rows, cols } = chooseGrid(pieceCount, image.width / image.height);
    const rand = mulberry32(seed);
    const layout = createLayout(rows, cols, boardW / cols, boardH / rows, rand);
    this.layout = layout;
    this.pad = piecePadding(layout);

    // Scale the source image once so large photos aren't resampled for every piece.
    const scaled = document.createElement('canvas');
    scaled.width = Math.ceil(boardW * this.dpr);
    scaled.height = Math.ceil(boardH * this.dpr);
    scaled.getContext('2d')!.drawImage(image, 0, 0, scaled.width, scaled.height);

    const pieces: Piece[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const path = new Path2D();
        tracePiece(pieceSides(layout, r, c), path);
        const { x, y } = this.scatterPosition(rand);
        const sprite = this.renderSprite(scaled, path, r, c);
        pieces.push({ row: r, col: c, x, y, group: r * cols + c, locked: false, path, sprite });
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

  private renderSprite(scaled: HTMLCanvasElement, path: Path2D, r: number, c: number): HTMLCanvasElement {
    const { cellW, cellH } = this.layout!;
    const pad = this.pad;
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil((cellW + 2 * pad) * this.dpr);
    sprite.height = Math.ceil((cellH + 2 * pad) * this.dpr);
    const ctx = sprite.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);
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

  /** Random cell position, preferring spots that don't cover the board. */
  private scatterPosition(rand: () => number): { x: number; y: number } {
    const { cellW, cellH } = this.layout!;
    const margin = this.pad;
    const maxX = Math.max(margin, this.width - cellW - margin);
    const maxY = Math.max(margin, this.height - cellH - margin);
    let pos = { x: margin, y: margin };
    for (let attempt = 0; attempt < 30; attempt++) {
      pos = { x: margin + rand() * (maxX - margin), y: margin + rand() * (maxY - margin) };
      const b = this.board;
      const overlapsBoard =
        pos.x + cellW > b.x && pos.x < b.x + b.w && pos.y + cellH > b.y && pos.y < b.y + b.h;
      if (!overlapsBoard) break;
    }
    return pos;
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    // Keep every group grabbable if the window shrank.
    if (this.layout) {
      const seen = new Set<number>();
      for (const p of this.pieces) {
        if (p.locked || seen.has(p.group)) continue;
        seen.add(p.group);
        const members = this.pieces.filter((m) => m.group === p.group);
        const [x, y] = this.clampToView(p.x, p.y);
        this.moveGroup(members, x - p.x, y - p.y);
      }
    }
    this.draw();
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
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.layout) return;

    const b = this.board;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    ctx.setLineDash([]);

    const { cellW, cellH } = this.layout;
    const pad = this.pad;
    const drawPiece = (p: Piece) =>
      ctx.drawImage(p.sprite, p.x - pad, p.y - pad, cellW + 2 * pad, cellH + 2 * pad);
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
  }

  private pointerPos(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** Topmost piece whose actual outline (not just its box) contains the point. */
  private pieceAt(x: number, y: number): Piece | null {
    const { cellW, cellH } = this.layout!;
    const pad = this.pad;
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      if (p.locked) continue;
      if (x < p.x - pad || x > p.x + cellW + pad || y < p.y - pad || y > p.y + cellH + pad) continue;
      const lx = x - p.x + p.col * cellW;
      const ly = y - p.y + p.row * cellH;
      if (this.hitCtx.isPointInPath(p.path, lx, ly)) return p;
    }
    return null;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.layout || this.drag) return;
    const { x, y } = this.pointerPos(e);
    const piece = this.pieceAt(x, y);
    if (!piece) return;
    // Lift the whole group to the top, keeping its internal stacking order.
    const members = this.pieces.filter((p) => p.group === piece.group);
    this.pieces = [...this.pieces.filter((p) => p.group !== piece.group), ...members];
    this.drag = { piece, members, pointerId: e.pointerId, dx: x - piece.x, dy: y - piece.y };
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.classList.add('dragging');
    this.requestDraw();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.drag?.pointerId !== e.pointerId) return;
    const { x, y } = this.pointerPos(e);
    const p = this.drag.piece;
    const [nx, ny] = this.clampToView(x - this.drag.dx, y - this.drag.dy);
    this.moveGroup(this.drag.members, nx - p.x, ny - p.y);
    this.requestDraw();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.drag?.pointerId !== e.pointerId) return;
    const { piece } = this.drag;
    this.drag = null;
    this.canvas.classList.remove('dragging');
    const wasSolved = isSolved(this.pieces);
    const { snapped } = settle(this.pieces, piece.group, this.snapGeometry());
    if (snapped) {
      // Locked pieces form the bottom layer so loose pieces always stay on top.
      this.pieces = [...this.pieces.filter((p) => p.locked), ...this.pieces.filter((p) => !p.locked)];
      if (!wasSolved && isSolved(this.pieces)) this.onSolved?.();
    }
    this.requestDraw();
  };
}
