# Puzzle Maker — Features

Upload an image and play it as a jigsaw puzzle in the browser. Everything runs locally; the image never leaves the browser.

## v1 (done)

- [x] Upload an image (decoded locally, EXIF orientation respected)
- [x] Choose piece count (12–300); the grid is fitted to the image's aspect ratio, and the actual count is shown
- [x] Classic jigsaw pieces: curved tabs and blanks with random variation, flat outer edges
- [x] Pieces scattered around the board outline; drag them with mouse, touch, or pen
- [x] "New cut" re-cuts the same image with a fresh random shape

## Backlog

Rough priority order — top items make the game feel complete.

- [ ] Lock in place: a piece dropped near its correct spot snaps onto the board and locks
- [ ] Completion detection and a "solved!" message with time taken
- [ ] Snap and group: neighboring pieces snap together when close and then move as a group
- [ ] Piece rotation: pieces start rotated; player rotates them (e.g. right-click / double-tap / key)
- [ ] Save progress: persist the current puzzle locally and resume later
- [ ] Preview: toggle a ghost image on the board or a thumbnail of the full picture
- [ ] Edge sorting: button to gather edge pieces together
- [ ] Zoom and pan for large piece counts
- [ ] Better touch support (pinch zoom, larger hit areas)
- [ ] Timer and move counter
- [ ] Drag-and-drop an image file onto the page
- [ ] Shuffle / re-scatter pieces without re-cutting
- [ ] Custom piece counts and difficulty presets
- [ ] Background color choice for the table
