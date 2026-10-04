import './style.css';
import { imageFiles, ShuffleBag } from './files';
import { formatDuration } from './format';
import { PuzzleGame } from './game';
import { MAX_PIECES, MIN_PIECES, parsePieceCount, presetFor, PRESETS } from './puzzle/difficulty';
import { PIECE_COUNT_OPTIONS } from './puzzle/grid';
import { fitSize, parsePreviewMode, PREVIEW_LABELS, PREVIEW_MODES, type PreviewMode } from './puzzle/preview';
import { parseSaved } from './puzzle/save';
import { MAX_ZOOM, MIN_ZOOM } from './puzzle/view';
import { playChime, playClick, playTap } from './sound';
import { clearState, loadSave, saveImage, saveState } from './storage';
import { isLightColor, TABLE_COLORS, tableColor } from './theme';

const canvas = document.querySelector<HTMLCanvasElement>('#board')!;
const fileInput = document.querySelector<HTMLInputElement>('#image-input')!;
const folderInput = document.querySelector<HTMLInputElement>('#folder-input')!;
const folderOption = document.querySelector<HTMLElement>('#folder-option')!;
const nextPictureButton = document.querySelector<HTMLButtonElement>('#next-picture')!;
const solvedNextButton = document.querySelector<HTMLButtonElement>('#solved-next')!;
const sizeSelect = document.querySelector<HTMLSelectElement>('#size')!;
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
const soundToggle = document.querySelector<HTMLInputElement>('#sound')!;
const rotateToggle = document.querySelector<HTMLInputElement>('#rotate')!;
const edgesFirstToggle = document.querySelector<HTMLInputElement>('#edges-first')!;
const helpButton = document.querySelector<HTMLButtonElement>('#help')!;
const helpDialog = document.querySelector<HTMLDialogElement>('#help-dialog')!;
const shuffleButton = document.querySelector<HTMLButtonElement>('#shuffle')!;
const edgesButton = document.querySelector<HTMLButtonElement>('#edges')!;
const zoomOutButton = document.querySelector<HTMLButtonElement>('#zoom-out')!;
const zoomInButton = document.querySelector<HTMLButtonElement>('#zoom-in')!;
const zoomResetButton = document.querySelector<HTMLButtonElement>('#zoom-reset')!;
const tableColorSelect = document.querySelector<HTMLSelectElement>('#table-color')!;
const previewSelect = document.querySelector<HTMLSelectElement>('#preview')!;
const optionsButton = document.querySelector<HTMLButtonElement>('#options')!;
const optionsPanel = document.querySelector<HTMLElement>('#options-panel')!;
const thumbnail = document.querySelector<HTMLCanvasElement>('#thumbnail')!;
const pictureDialog = document.querySelector<HTMLDialogElement>('#picture-dialog')!;
const pictureLarge = document.querySelector<HTMLCanvasElement>('#picture-large')!;

const SOUND_KEY = 'puzzle-maker:sound';
const ROTATE_KEY = 'puzzle-maker:rotate';
const EDGES_FIRST_KEY = 'puzzle-maker:edges-first';
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
soundToggle.checked = soundOn;
rotateToggle.checked = readPref(ROTATE_KEY) === 'on';
soundToggle.addEventListener('change', () => {
  soundOn = soundToggle.checked;
  writePref(SOUND_KEY, soundOn ? 'on' : 'off');
});

// The Options panel opens just below its button, kept inside the window.
const PANEL_MARGIN = 8;
optionsPanel.addEventListener('beforetoggle', (e) => {
  const open = (e as ToggleEvent).newState === 'open';
  optionsButton.setAttribute('aria-expanded', String(open));
  if (!open) return;
  const r = optionsButton.getBoundingClientRect();
  const width = Math.min(optionsPanel.offsetWidth || 240, window.innerWidth - 2 * PANEL_MARGIN);
  const left = Math.max(PANEL_MARGIN, Math.min(r.left, window.innerWidth - width - PANEL_MARGIN));
  optionsPanel.style.left = `${left}px`;
  optionsPanel.style.top = `${r.bottom + 6}px`;
});
window.addEventListener('resize', () => optionsPanel.hidePopover());

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
/** Menu values for plain piece counts, e.g. "n:48" (preset values are their ids). */
const COUNT_PREFIX = 'n:';

// One menu: the difficulty presets, then plain piece counts (which keep the rotation setting).
const presetGroup = document.createElement('optgroup');
presetGroup.label = 'Difficulty';
for (const p of PRESETS) {
  presetGroup.append(new Option(`${p.label} · ${p.pieces}${p.rotate ? ', rotated' : ''}`, p.id));
}
const countGroup = document.createElement('optgroup');
countGroup.label = 'Piece count';
for (const n of PIECE_COUNT_OPTIONS) countGroup.append(new Option(`${n} pieces`, COUNT_PREFIX + n));
/** Shows a typed count that isn't one of the listed choices. */
const typedCountOption = new Option();
const customChoice = new Option('Custom…', CUSTOM);
countGroup.append(customChoice);
sizeSelect.append(presetGroup, countGroup);
customInput.min = String(MIN_PIECES);
customInput.max = String(MAX_PIECES);

let pieceCount = DEFAULT_COUNT;

function requestedCount(): number {
  return pieceCount;
}

/** Shows the matching preset if there is one, otherwise the piece count. */
function renderSize(): void {
  if (PIECE_COUNT_OPTIONS.some((option) => option === pieceCount)) typedCountOption.remove();
  else {
    typedCountOption.text = `${pieceCount} pieces`;
    typedCountOption.value = COUNT_PREFIX + pieceCount;
    countGroup.insertBefore(typedCountOption, customChoice);
  }
  sizeSelect.value = presetFor(pieceCount, rotateToggle.checked)?.id ?? COUNT_PREFIX + pieceCount;
}

function setCount(n: number): void {
  pieceCount = n;
  renderSize();
}
renderSize();

const game = new PuzzleGame(canvas);

edgesFirstToggle.checked = readPref(EDGES_FIRST_KEY) === 'on';
game.edgesFirst = edgesFirstToggle.checked;
edgesFirstToggle.addEventListener('change', () => {
  game.edgesFirst = edgesFirstToggle.checked;
  writePref(EDGES_FIRST_KEY, edgesFirstToggle.checked ? 'on' : 'off');
});

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
  previewSelect.value = previewMode;
  game.showGhost = previewMode === 'ghost';
  thumbnail.hidden = previewMode !== 'thumbnail' || !game.hasImage || game.solved;
}
function setPreview(mode: PreviewMode): void {
  previewMode = mode;
  writePref(PREVIEW_KEY, mode);
  renderPreview();
}
for (const m of PREVIEW_MODES) previewSelect.add(new Option(PREVIEW_LABELS[m], m));
previewSelect.addEventListener('change', () => setPreview(parsePreviewMode(previewSelect.value)));
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
  if (currentPicture) {
    pictures.remove(currentPicture);
    currentPicture = null;
    renderNextPicture();
  }
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

async function openFile(file: File): Promise<boolean> {
  try {
    useImage(await decode(file));
  } catch {
    status.textContent = `Couldn't read "${file.name}" as an image.`;
    return false;
  }
  await saveImage(file);
  cut();
  return true;
}

// The pictures from the last pick (several files, a folder, or a drop). A
// picture leaves the pool once it is solved (or fails to decode), so it isn't
// dealt again and its File can be let go. Only the one being played is saved,
// so the pool doesn't survive a reload.
let pictures = new ShuffleBag<File>([]);
let currentPicture: File | null = null;

/** Shows "Next picture" while the pool holds a picture other than the current one. */
function renderNextPicture(): void {
  const others = pictures.size - (currentPicture && pictures.has(currentPicture) ? 1 : 0);
  for (const button of [nextPictureButton, solvedNextButton]) button.hidden = others === 0;
  nextPictureButton.title =
    others === 1 ? 'Start a puzzle from the last unsolved picture' : `Start a puzzle from one of ${others} unsolved pictures`;
}

/** Opens a random picture from the pool, dropping any that won't decode. */
async function openNextPicture(): Promise<void> {
  let file: File | undefined;
  while ((file = pictures.next())) {
    if (await openFile(file)) {
      currentPicture = file;
      break;
    }
    pictures.remove(file);
  }
  renderNextPicture();
}

function usePictures(files: Iterable<File>, none: string): void {
  const images = imageFiles(files);
  if (images.length === 0) {
    status.textContent = none;
    return;
  }
  pictures = new ShuffleBag(images);
  currentPicture = null;
  void openNextPicture();
}
for (const button of [nextPictureButton, solvedNextButton]) button.addEventListener('click', () => void openNextPicture());

// A built-in picture for trying the game without one of your own.
const SAMPLE_URL = `${import.meta.env.BASE_URL}sample.jpg`;
async function openSample(): Promise<void> {
  // The sample isn't in the pool; solving it shouldn't take anything out.
  currentPicture = null;
  renderNextPicture();
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

for (const input of [fileInput, folderInput]) {
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])];
    // Allow picking the same files again to start over.
    input.value = '';
    if (files.length === 0) return;
    optionsPanel.hidePopover();
    usePictures(files, input === folderInput ? 'That folder has no images in it.' : "That isn't an image file.");
  });
}

// Phones ignore webkitdirectory (or open a file manager instead of the photo
// gallery), so the folder picker is only offered with a mouse or trackpad.
if ('webkitdirectory' in folderInput && matchMedia('(pointer: fine)').matches) {
  folderOption.hidden = false;
}

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
  usePictures(e.dataTransfer!.files, 'Drop an image file to make a puzzle from it.');
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
  rotateToggle.checked = state.rotate;
  setCount(state.pieceCount);
  showPuzzle(game.restore(state));
}
void resume();

sizeSelect.addEventListener('change', () => {
  if (sizeSelect.value === CUSTOM) {
    // Wait for a number before re-cutting.
    customInput.value = String(pieceCount);
    customInput.hidden = false;
    customInput.focus();
    customInput.select();
    return;
  }
  customInput.hidden = true;
  const preset = PRESETS.find((p) => p.id === sizeSelect.value);
  if (preset) {
    rotateToggle.checked = preset.rotate;
    writePref(ROTATE_KEY, preset.rotate ? 'on' : 'off');
  }
  setCount(preset?.pieces ?? Number(sizeSelect.value.slice(COUNT_PREFIX.length)));
  cut();
});
customInput.addEventListener('change', () => {
  const n = parsePieceCount(customInput.value);
  if (n === null) return;
  customInput.hidden = true;
  setCount(n);
  cut();
});
customInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === 'Escape') customInput.blur();
});
// Leaving the box (Esc, or without a number) goes back to the current size.
customInput.addEventListener('blur', () => {
  customInput.hidden = true;
  renderSize();
});
rotateToggle.addEventListener('change', () => {
  writePref(ROTATE_KEY, rotateToggle.checked ? 'on' : 'off');
  renderSize();
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
