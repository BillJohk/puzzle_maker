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
- [x] Zoom and pan for large piece counts: mouse-wheel zoom about the cursor (100–400%) and − / % / + toolbar buttons; drag an empty spot to pan while zoomed in. Piece sprites are rendered at extra resolution (within a memory budget) so they stay sharp when zoomed
- [x] Better touch support: two-finger pinch zooms and pans the table; fingers and pens pick up a piece even on a near miss (within ~22 px of its outline); larger toolbar controls on touch screens
- [x] Drag-and-drop an image file onto the page (the table shows a drop highlight; the first image among the dropped files is used)
- [x] Shuffle / re-scatter pieces without re-cutting: "Shuffle" moves every loose piece and group (kept together) to a random spot off the board and restacks them; locked pieces, time and moves are untouched
- [x] Custom piece counts and difficulty presets: a Difficulty menu (Easy 24, Medium 48, Hard 150 rotated, Expert 300 rotated) sets count and rotation together and shows "Custom" otherwise; "Custom…" in the piece-count menu takes any count from 4 to 500 (zoom keeps the small pieces playable)
- [x] Background color choice for the table: a toolbar menu of table colors (green felt, which follows light/dark mode, plus navy, wine, charcoal, walnut, sand and paper), remembered; light colors switch the table text and board outline to dark so they stay readable
- [x] Counter-rotation: Shift+R / Shift+Space while dragging turns a piece counterclockwise
- [x] Large preview: click the corner thumbnail to view the whole picture large; click again (or Esc) to close
- [x] Sample puzzle: a built-in photo (Seattle skyline, metadata stripped) from the empty-state button or the link in How to play
- [x] Collapsible menu bar: the ▴ / ▾ button folds the toolbar down to just the status line for more table room on phones; remembered
- [x] Re-fit on resize: when the table changes size (a phone turning, a window resized, the menu folded), the board is laid out again for the new size, keeping pieces in place relative to the board along with the clock and moves
