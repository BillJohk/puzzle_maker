import './style.css';
import { firstImageFile } from './files';
import { formatDuration } from './format';
import { PuzzleGame } from './game';
import { PIECE_COUNT_OPTIONS } from './puzzle/grid';
import { fitSize, nextPreviewMode, parsePreviewMode, PREVIEW_LABELS, type PreviewMode } from './puzzle/preview';
import { parseSaved } from './puzzle/save';
import { MAX_ZOOM, MIN_ZOOM } from './puzzle/view';
import { playChime, playClick, playTap } from './sound';
import { clearSave, loadSave, saveImage, saveState } from './storage';

const canvas = document.querySelector<HTMLCanvasElement>('#board')!;
const fileInput = document.querySelector<HTMLInputElement>('#image-input')!;
const countSelect = document.querySelector<HTMLSelectElement>('#piece-count')!;
const recutButton = document.querySelector<HTMLButtonElement>('#recut')!;
const status = document.querySelector<HTMLElement>('#status')!;
const emptyState = document.querySelector<HTMLElement>('#empty-state')!;
const solvedBanner = document.querySelector<HTMLElement>('#solved-banner')!;
const solvedDetail = document.querySelector<HTMLElement>('#solved-detail')!;
const playAgainButton = document.querySelector<HTMLButtonElement>('#play-again')!;
const soundButton = document.querySelector<HTMLButtonElement>('#sound')!;
const rotateToggle = document.querySelector<HTMLInputElement>('#rotate')!;
const helpButton = document.querySelector<HTMLButtonElement>('#help')!;
const helpDialog = document.querySelector<HTMLDialogElement>('#help-dialog')!;
const shuffleButton = document.querySelector<HTMLButtonElement>('#shuffle')!;
const edgesButton = document.querySelector<HTMLButtonElement>('#edges')!;
const zoomOutButton = document.querySelector<HTMLButtonElement>('#zoom-out')!;
const zoomInButton = document.querySelector<HTMLButtonElement>('#zoom-in')!;
const zoomResetButton = document.querySelector<HTMLButtonElement>('#zoom-reset')!;
const previewButton = document.querySelector<HTMLButtonElement>('#preview')!;
const thumbnail = document.querySelector<HTMLCanvasElement>('#thumbnail')!;

const SOUND_KEY = 'puzzle-maker:sound';
const ROTATE_KEY = 'puzzle-maker:rotate';
const HELP_SEEN_KEY = 'puzzle-maker:help-seen';
const PREVIEW_KEY = 'puzzle-maker:preview';
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are a convenience; ignore storage failures.
  }
}

let soundOn = readPref(SOUND_KEY) !== 'off';
function renderSoundButton(): void {
  soundButton.setAttribute('aria-pressed', String(soundOn));
  soundButton.textContent = soundOn ? 'Sound on' : 'Sound off';
}
renderSoundButton();
rotateToggle.checked = readPref(ROTATE_KEY) === 'on';
soundButton.addEventListener('click', () => {
  soundOn = !soundOn;
  writePref(SOUND_KEY, soundOn ? 'on' : 'off');
  renderSoundButton();
});

helpButton.addEventListener('click', () => helpDialog.showModal());
// Clicking the backdrop (outside the panel) closes it too.
helpDialog.addEventListener('click', (e) => {
  if (e.target === helpDialog) helpDialog.close();
});
if (readPref(HELP_SEEN_KEY) === null) {
  writePref(HELP_SEEN_KEY, '1');
  helpDialog.showModal();
}

const DEFAULT_COUNT = 48;
for (const n of PIECE_COUNT_OPTIONS) {
  countSelect.add(new Option(`${n} pieces`, String(n), n === DEFAULT_COUNT, n === DEFAULT_COUNT));
}

const game = new PuzzleGame(canvas);

const THUMB_MAX_W = 220;
const THUMB_MAX_H = 160;
let previewMode = parsePreviewMode(readPref(PREVIEW_KEY));
function renderPreview(): void {
  previewButton.textContent = PREVIEW_LABELS[previewMode];
  game.showGhost = previewMode === 'ghost';
  thumbnail.hidden = previewMode !== 'thumbnail' || !game.hasImage || game.solved;
}
function setPreview(mode: PreviewMode): void {
  previewMode = mode;
  writePref(PREVIEW_KEY, mode);
  renderPreview();
}
previewButton.addEventListener('click', () => setPreview(nextPreviewMode(previewMode)));
renderPreview();

function drawThumbnail(image: ImageBitmap): void {
  const { w, h } = fitSize(image.width, image.height, THUMB_MAX_W, THUMB_MAX_H);
  const dpr = window.devicePixelRatio || 1;
  thumbnail.width = Math.round(w * dpr);
  thumbnail.height = Math.round(h * dpr);
  thumbnail.style.width = `${w}px`;
  thumbnail.style.height = `${h}px`;
  thumbnail.getContext('2d')!.drawImage(image, 0, 0, thumbnail.width, thumbnail.height);
}
let sizeLabel = '';

const movesLabel = (n: number) => `${n} ${n === 1 ? 'move' : 'moves'}`;

function updateStatus(): void {
  if (!game.hasImage) return;
  const solved = game.solved ? 'Solved! ' : '';
  status.textContent = `${solved}${sizeLabel} · ${formatDuration(game.elapsedMs)} · ${movesLabel(game.moves)}`;
}

// Progress is saved shortly after each change, and right away when the page is hidden.
const SAVE_DELAY_MS = 500;
let saveTimer = 0;
function saveNow(): void {
  window.clearTimeout(saveTimer);
  saveTimer = 0;
  const state = game.snapshot();
  if (state) void saveState(state);
}
function scheduleSave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, SAVE_DELAY_MS);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && game.hasImage && !game.solved) saveNow();
});

game.onProgress = () => {
  updateStatus();
  scheduleSave();
};
game.onSnap = (kind) => {
  if (soundOn) playClick(kind === 'lock' ? 0.75 : 1);
};
game.onPickUp = () => {
  if (soundOn) playTap();
};
game.onSolved = () => {
  window.clearTimeout(saveTimer);
  void clearSave();
  if (soundOn) playChime();
  updateStatus();
  solvedDetail.textContent = `${sizeLabel} in ${formatDuration(game.elapsedMs)}, ${movesLabel(game.moves)}`;
  solvedBanner.hidden = false;
  renderPreview();
};
setInterval(updateStatus, 1000);

function showPuzzle({ rows, cols }: { rows: number; cols: number }): void {
  sizeLabel = `${cols} × ${rows} = ${rows * cols} pieces`;
  solvedBanner.hidden = true;
  renderPreview();
  updateStatus();
}

function cut(): void {
  if (!game.hasImage) return;
  showPuzzle(game.generate(Number(countSelect.value), { rotate: rotateToggle.checked }));
  saveNow();
}

// Decoded locally; the image never leaves the browser.
const decode = (image: Blob) => createImageBitmap(image, { imageOrientation: 'from-image' });

function useImage(bitmap: ImageBitmap): void {
  game.setImage(bitmap);
  drawThumbnail(bitmap);
  emptyState.hidden = true;
  recutButton.disabled = false;
  edgesButton.disabled = false;
  shuffleButton.disabled = false;
  renderZoom();
}

async function openFile(file: File): Promise<void> {
  try {
    useImage(await decode(file));
  } catch {
    status.textContent = `Couldn't read "${file.name}" as an image.`;
    return;
  }
  await saveImage(file);
  cut();
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  // Allow picking the same file again to start over.
  fileInput.value = '';
  if (file) void openFile(file);
});

// Dropping an image anywhere on the page opens it. Without preventDefault on
// both events the browser would navigate to the file instead.
let dragDepth = 0;
const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  dragDepth++;
  document.body.classList.add('drop-target');
});
window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove('drop-target');
});
window.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'copy';
});
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('drop-target');
  const file = firstImageFile(e.dataTransfer!.files);
  if (file) void openFile(file);
  else status.textContent = 'Drop an image file to make a puzzle from it.';
});

/** Picks up where the player left off, if a puzzle was saved in this browser. */
async function resume(): Promise<void> {
  const saved = await loadSave();
  const state = parseSaved(saved?.state);
  if (!saved || !state || game.hasImage) return;
  try {
    const bitmap = await decode(saved.image);
    if (game.hasImage) return; // The player chose an image meanwhile.
    useImage(bitmap);
  } catch {
    return;
  }
  if (!PIECE_COUNT_OPTIONS.some((n) => n === state.pieceCount)) state.pieceCount = DEFAULT_COUNT;
  countSelect.value = String(state.pieceCount);
  rotateToggle.checked = state.rotate;
  showPuzzle(game.restore(state));
}
void resume();

countSelect.addEventListener('change', cut);
rotateToggle.addEventListener('change', () => {
  writePref(ROTATE_KEY, rotateToggle.checked ? 'on' : 'off');
  cut();
});
recutButton.addEventListener('click', cut);

const ZOOM_STEP = 1.5;
function renderZoom(): void {
  zoomResetButton.textContent = `${Math.round(game.zoom * 100)}%`;
  zoomOutButton.disabled = !game.hasImage || game.zoom <= MIN_ZOOM;
  zoomInButton.disabled = !game.hasImage || game.zoom >= MAX_ZOOM;
  zoomResetButton.disabled = !game.hasImage;
}
game.onViewChange = renderZoom;
zoomInButton.addEventListener('click', () => game.zoomBy(ZOOM_STEP));
zoomOutButton.addEventListener('click', () => game.zoomBy(1 / ZOOM_STEP));
zoomResetButton.addEventListener('click', () => game.resetView());
edgesButton.addEventListener('click', () => game.gatherEdges());
shuffleButton.addEventListener('click', () => game.shuffle());
playAgainButton.addEventListener('click', cut);
