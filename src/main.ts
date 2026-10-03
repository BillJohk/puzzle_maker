import './style.css';
import { formatDuration } from './format';
import { PuzzleGame } from './game';
import { PIECE_COUNT_OPTIONS } from './puzzle/grid';
import { fitSize, nextPreviewMode, parsePreviewMode, PREVIEW_LABELS, type PreviewMode } from './puzzle/preview';
import { parseSaved } from './puzzle/save';
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
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    useImage(await decode(file));
    await saveImage(file);
    cut();
  } catch {
    status.textContent = `Couldn't read "${file.name}" as an image.`;
  } finally {
    // Allow picking the same file again to start over.
    fileInput.value = '';
  }
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
playAgainButton.addEventListener('click', cut);
