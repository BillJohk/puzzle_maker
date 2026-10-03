import './style.css';
import { formatDuration } from './format';
import { PuzzleGame } from './game';
import { PIECE_COUNT_OPTIONS } from './puzzle/grid';
import { playClick } from './sound';

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

const SOUND_KEY = 'puzzle-maker:sound';
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
soundButton.addEventListener('click', () => {
  soundOn = !soundOn;
  writePref(SOUND_KEY, soundOn ? 'on' : 'off');
  renderSoundButton();
});

const DEFAULT_COUNT = 48;
for (const n of PIECE_COUNT_OPTIONS) {
  countSelect.add(new Option(`${n} pieces`, String(n), n === DEFAULT_COUNT, n === DEFAULT_COUNT));
}

const game = new PuzzleGame(canvas);
let sizeLabel = '';

const movesLabel = (n: number) => `${n} ${n === 1 ? 'move' : 'moves'}`;

function updateStatus(): void {
  if (!game.hasImage) return;
  const solved = game.solved ? 'Solved! ' : '';
  status.textContent = `${solved}${sizeLabel} · ${formatDuration(game.elapsedMs)} · ${movesLabel(game.moves)}`;
}

game.onProgress = updateStatus;
game.onSnap = (kind) => {
  if (soundOn) playClick(kind === 'lock' ? 0.75 : 1);
};
game.onSolved = () => {
  updateStatus();
  solvedDetail.textContent = `${sizeLabel} in ${formatDuration(game.elapsedMs)}, ${movesLabel(game.moves)}`;
  solvedBanner.hidden = false;
};
setInterval(updateStatus, 1000);

function cut(): void {
  if (!game.hasImage) return;
  const { rows, cols } = game.generate(Number(countSelect.value));
  sizeLabel = `${cols} × ${rows} = ${rows * cols} pieces`;
  solvedBanner.hidden = true;
  updateStatus();
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    // Decoded locally; the image never leaves the browser.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    game.setImage(bitmap);
    emptyState.hidden = true;
    recutButton.disabled = false;
    cut();
  } catch {
    status.textContent = `Couldn't read "${file.name}" as an image.`;
  } finally {
    // Allow picking the same file again to start over.
    fileInput.value = '';
  }
});

countSelect.addEventListener('change', cut);
recutButton.addEventListener('click', cut);
playAgainButton.addEventListener('click', cut);
