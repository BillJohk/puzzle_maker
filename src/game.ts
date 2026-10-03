import { chooseGrid, type Grid } from './puzzle/grid';
import { mulberry32 } from './puzzle/rng';
import { createLayout, pieceSides, piecePadding, tracePiece, type PuzzleLayout } from './puzzle/shape';

interface Piece {
  row: number;
  col: number;
  /** Outline in board coordinates. */
  path: Path2D;
  /** Pre-rendered image of the piece, including `pad` on every side. */
  sprite: HTMLCanvasElement;
  /** Canvas position (CSS px) of the piece's cell top-left corner. */
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Drag {
  piece: Piece;
  pointerId: number;
  dx: number;
  dy: number;
}

/** Fraction of the play area the assembled puzzle may occupy; the rest holds scattered pieces. */
const BOARD_MAX_W = 0.6;
const BOARD_MAX_H = 0.7;

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
        pieces.push({ row: r, col: c, path, sprite: this.renderSprite(scaled, path, r, c), x, y });
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
    // Keep every piece grabbable if the window shrank.
    if (this.layout) {
      for (const p of this.pieces) this.clampToView(p);
    }
    this.draw();
  }

  private clampToView(p: Piece): void {
    const { cellW, cellH } = this.layout!;
    p.x = Math.min(Math.max(p.x, -cellW / 2), this.width - cellW / 2);
    p.y = Math.min(Math.max(p.y, -cellH / 2), this.height - cellH / 2);
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
    for (const p of this.pieces) {
      const dragging = this.drag?.piece === p;
      if (dragging) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;
      }
      ctx.drawImage(p.sprite, p.x - pad, p.y - pad, cellW + 2 * pad, cellH + 2 * pad);
      if (dragging) ctx.restore();
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
    this.pieces.splice(this.pieces.indexOf(piece), 1);
    this.pieces.push(piece);
    this.drag = { piece, pointerId: e.pointerId, dx: x - piece.x, dy: y - piece.y };
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.classList.add('dragging');
    this.requestDraw();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.drag?.pointerId !== e.pointerId) return;
    const { x, y } = this.pointerPos(e);
    const p = this.drag.piece;
    p.x = x - this.drag.dx;
    p.y = y - this.drag.dy;
    this.clampToView(p);
    this.requestDraw();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.drag?.pointerId !== e.pointerId) return;
    this.drag = null;
    this.canvas.classList.remove('dragging');
    this.requestDraw();
  };
}
