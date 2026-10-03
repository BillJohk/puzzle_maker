# Puzzle Maker — Features

Upload an image and play it as a jigsaw puzzle in the browser. Everything runs locally; the image never leaves the browser.

## v1 (done)

- [x] Upload an image (decoded locally, EXIF orientation respected)
- [x] Choose piece count (12–300); the grid is fitted to the image's aspect ratio, and the actual count is shown
- [x] Classic jigsaw pieces: curved tabs and blanks with random variation, flat outer edges
- [x] Pieces scattered around the board outline; drag them with mouse, touch, or pen
- [x] "New cut" re-cuts the same image with a fresh random shape

## v2

- [x] Snap and group: neighboring pieces snap together when dropped close and then move as a group
- [x] Lock in place: a piece or group dropped near its correct spot snaps onto the board and locks
- [x] Completion detection: "Solved!" shown when the last piece joins

## v3

- [x] Solved celebration: the finished picture glides onto the board, outlines fade away, a shine sweeps across, and a banner shows time and moves
- [x] Timer and move counter in the toolbar (clock starts on the first grab)
- [x] Snap feedback: a brief glow and a wooden click when pieces join (lower click when locking to the board); sound toggle remembered
- [x] Solved chime (rising C-major arpeggio) and a soft tap when picking up a piece
- [x] Piece rotation (optional "Rotate pieces" toggle, off by default): pieces start at random quarter turns; right-click or double-tap a piece, or press R / Space while dragging, to turn it. Pieces only join when turned the same way, and only lock onto the board when upright

## Backlog

Rough priority order — top items make the game feel complete.

- [x] How to play: a help panel (toolbar button, shown on first visit) listing the controls: drag to move, right-click / double-tap / R / Space to rotate, snapping and locking rules
- [x] Save progress: the image and puzzle state (piece positions, turns, groups, time, moves) are saved in IndexedDB as you play and restored on the next visit, lined up to the new window size; the save is cleared when the puzzle is solved
- [x] Preview: a toolbar button cycles between no preview, a faint ghost of the picture on the board under the pieces, and a thumbnail of the full picture in the corner; the choice is remembered
- [x] Edge sorting: "Gather edges" lays the loose border pieces out in a tidy grid in the roomiest strip beside the board (overlapping like shingles when crowded) and moves loose inner pieces out of that strip
- [ ] Zoom and pan for large piece counts
- [ ] Better touch support (pinch zoom, larger hit areas)
- [ ] Drag-and-drop an image file onto the page
- [ ] Shuffle / re-scatter pieces without re-cutting
- [ ] Custom piece counts and difficulty presets
- [ ] Background color choice for the table
