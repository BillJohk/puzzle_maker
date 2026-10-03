import './style.css';
import { firstImageFile } from './files';
import { formatDuration } from './format';
import { PuzzleGame } from './game';
import { MAX_PIECES, MIN_PIECES, parsePieceCount, presetFor, PRESETS } from './puzzle/difficulty';
import { PIECE_COUNT_OPTIONS } from './puzzle/grid';
import { fitSize, nextPreviewMode, parsePreviewMode, PREVIEW_LABELS, type PreviewMode } from './puzzle/preview';
import { parseSaved } from './puzzle/save';
import { MAX_ZOOM, MIN_ZOOM } from './puzzle/view';
import { playChime, playClick, playTap } from './sound';
import { clearState, loadSave, saveImage, saveState } from './storage';
import { isLightColor, TABLE_COLORS, tableColor } from './theme';

const canvas = document.querySelector<HTMLCanvasElement>('#board')!;
const fileInput = document.querySelector<HTMLInputElement>('#image-input')!;
const countSelect = document.querySelector<HTMLSelectElement>('#piece-count')!;
const difficultySelect = document.querySelector<HTMLSelectElement>('#difficulty')!;
const customInput = document.querySelector<HTMLInputElement>('#custom-count')!;
const recutButton = document.querySelector<HTMLButtonElement>('#recut')!;
const status = document.querySelector<HTMLElement>('#status')!;
const emptyState = document.querySelector<HTMLElement>('#empty-state')!;
const toolbar = document.querySelector<HTMLElement>('.toolbar')!;
const menuToggle = document.querySelector<HTMLButtonElement>('#menu-toggle')!;
const sampleButton = document.querySelector<HTMLButtonElement>('#sample')!;
const helpSampleButton = document.querySelector<HTMLButtonElement>('#help-sample')!;
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
const tableColorSelect = document.querySelector<HTMLSelectElement>('#table-color')!;
const previewButton = document.querySelector<HTMLButtonElement>('#preview')!;
const thumbnail = document.querySelector<HTMLCanvasElement>('#thumbnail')!;
const pictureDialog = document.querySelector<HTMLDialogElement>('#picture-dialog')!;
const pictureLarge = document.querySelector<HTMLCanvasElement>('#picture-large')!;

const SOUND_KEY = 'puzzle-maker:sound';
const ROTATE_KEY = 'puzzle-maker:rotate';
const HELP_SEEN_KEY = 'puzzle-maker:help-seen';
const PREVIEW_KEY = 'puzzle-maker:preview';
const TABLE_COLOR_KEY = 'puzzle-maker:table-color';
const MENU_KEY = 'puzzle-maker:menu';
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
const CUSTOM = 'custom';
for (const n of PIECE_COUNT_OPTIONS) {
  countSelect.add(new Option(`${n} pieces`, String(n), n === DEFAULT_COUNT, n === DEFAULT_COUNT));
}
countSelect.add(new Option('Custom…', CUSTOM));
for (const p of PRESETS) {
  difficultySelect.add(new Option(`${p.label} · ${p.pieces}${p.rotate ? ', rotated' : ''}`, p.id));
}
difficultySelect.add(new Option('Custom', CUSTOM));
customInput.min = String(MIN_PIECES);
customInput.max = String(MAX_PIECES);

/** The last custom count entered, used while "Custom…" is selected. */
let customCount = DEFAULT_COUNT;

function requestedCount(): number {
  return countSelect.value === CUSTOM ? customCount : Number(countSelect.value);
}

/** Shows `n` in the piece-count controls, switching to a custom count if it isn't a listed choice. */
function setCount(n: number): void {
  const listed = PIECE_COUNT_OPTIONS.some((option) => option === n);
  if (!listed) customCount = n;
  countSelect.value = listed ? String(n) : CUSTOM;
  customInput.value = String(customCount);
  customInput.hidden = listed;
}

/** Shows which preset (if any) the current count and rotation match. */
function renderDifficulty(): void {
  difficultySelect.value = presetFor(requestedCount(), rotateToggle.checked)?.id ?? CUSTOM;
}
renderDifficulty();

const game = new PuzzleGame(canvas);

for (const c of TABLE_COLORS) tableColorSelect.add(new Option(c.label, c.id));
function applyTableColor(id: string | null): void {
  const { id: chosen, color } = tableColor(id);
  tableColorSelect.value = chosen;
  const root = document.documentElement;
  if (color) root.style.setProperty('--table-bg', color);
  else root.style.removeProperty('--table-bg');
  const light = color !== null && isLightColor(color);
  root.classList.toggle('light-table', light);
  game.onLightTable = light;
}
applyTableColor(readPref(TABLE_COLOR_KEY));

// The menu bar folds away to leave more room for the table on small screens.
function setMenuOpen(open: boolean): void {
  toolbar.classList.toggle('collapsed', !open);
  menuToggle.textContent = open ? '▴' : '▾';
  menuToggle.title = menuToggle.ariaLabel = open ? 'Hide menu' : 'Show menu';
  menuToggle.setAttribute('aria-expanded', String(open));
}
setMenuOpen(readPref(MENU_KEY) !== 'closed');
menuToggle.addEventListener('click', () => {
  const open = toolbar.classList.contains('collapsed');
  setMenuOpen(open);
  writePref(MENU_KEY, open ? 'open' : 'closed');
});
tableColorSelect.addEventListener('change', () => {
  writePref(TABLE_COLOR_KEY, tableColorSelect.value);
  applyTableColor(tableColorSelect.value);
});

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

/** Draws `image` into `canvas`, scaled to fit maxW × maxH CSS px. */
function drawFitted(canvas: HTMLCanvasElement, image: ImageBitmap, maxW: number, maxH: number): void {
  const { w, h } = fitSize(image.width, image.height, maxW, maxH);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
}

let currentImage: ImageBitmap | null = null;
function drawThumbnail(image: ImageBitmap): void {
  currentImage = image;
  drawFitted(thumbnail, image, THUMB_MAX_W, THUMB_MAX_H);
}

// New pieces are placed clear of the corner thumbnail. Measured from its CSS so this
// works before it is first shown (it is hidden until the puzzle is cut).
game.coveredArea = () => {
  if (previewMode !== 'thumbnail' || !currentImage) return null;
  const cs = getComputedStyle(thumbnail);
  const border = parseFloat(cs.borderTopWidth) || 0;
  const w = parseFloat(thumbnail.style.width) + 2 * border;
  const h = parseFloat(thumbnail.style.height) + 2 * border;
  return { x: canvas.clientWidth - parseFloat(cs.right) - w, y: parseFloat(cs.top), w, h };
};

// Click the thumbnail for a large view; any click closes it.
thumbnail.addEventListener('click', () => {
  if (!currentImage) return;
  drawFitted(pictureLarge, currentImage, window.innerWidth * 0.9, window.innerHeight * 0.85);
  pictureDialog.showModal();
});
pictureDialog.addEventListener('click', () => pictureDialog.close());
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
  void clearState();
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
  showPuzzle(game.generate(requestedCount(), { rotate: rotateToggle.checked }));
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

// A built-in picture for trying the game without one of your own.
const SAMPLE_URL = `${import.meta.env.BASE_URL}sample.jpg`;
async function openSample(): Promise<void> {
  try {
    const res = await fetch(SAMPLE_URL);
    if (!res.ok) throw new Error(res.statusText);
    await openFile(new File([await res.blob()], 'sample.jpg', { type: 'image/jpeg' }));
  } catch {
    status.textContent = "Couldn't load the sample picture.";
  }
}
sampleButton.addEventListener('click', () => void openSample());
helpSampleButton.addEventListener('click', () => {
  helpDialog.close();
  void openSample();
});

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
  setCount(state.pieceCount);
  rotateToggle.checked = state.rotate;
  renderDifficulty();
  showPuzzle(game.restore(state));
}
void resume();

countSelect.addEventListener('change', () => {
  if (countSelect.value === CUSTOM) {
    // Wait for a number before re-cutting.
    customInput.value = String(customCount);
    customInput.hidden = false;
    customInput.focus();
    customInput.select();
    return;
  }
  customInput.hidden = true;
  renderDifficulty();
  cut();
});
customInput.addEventListener('change', () => {
  const n = parsePieceCount(customInput.value);
  customInput.value = String(n ?? customCount);
  if (n === null) return;
  customCount = n;
  renderDifficulty();
  cut();
});
customInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') customInput.blur();
});
difficultySelect.addEventListener('change', () => {
  const preset = PRESETS.find((p) => p.id === difficultySelect.value);
  if (!preset) {
    // "Custom" just means "set the count and rotation yourself".
    countSelect.focus();
    return;
  }
  setCount(preset.pieces);
  rotateToggle.checked = preset.rotate;
  writePref(ROTATE_KEY, preset.rotate ? 'on' : 'off');
  cut();
});
rotateToggle.addEventListener('change', () => {
  writePref(ROTATE_KEY, rotateToggle.checked ? 'on' : 'off');
  renderDifficulty();
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
