import './style.css';
import { PuzzleGame } from './game';
import { PIECE_COUNT_OPTIONS } from './puzzle/grid';

const canvas = document.querySelector<HTMLCanvasElement>('#board')!;
const fileInput = document.querySelector<HTMLInputElement>('#image-input')!;
const countSelect = document.querySelector<HTMLSelectElement>('#piece-count')!;
const recutButton = document.querySelector<HTMLButtonElement>('#recut')!;
const status = document.querySelector<HTMLElement>('#status')!;
const emptyState = document.querySelector<HTMLElement>('#empty-state')!;

const DEFAULT_COUNT = 48;
for (const n of PIECE_COUNT_OPTIONS) {
  countSelect.add(new Option(`${n} pieces`, String(n), n === DEFAULT_COUNT, n === DEFAULT_COUNT));
}

const game = new PuzzleGame(canvas);
game.onSolved = () => {
  status.textContent = `Solved! ${status.textContent}`;
};

function cut(): void {
  if (!game.hasImage) return;
  const { rows, cols } = game.generate(Number(countSelect.value));
  status.textContent = `${cols} × ${rows} = ${rows * cols} pieces`;
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
