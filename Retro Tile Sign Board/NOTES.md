# Build notes

State of the project as of commit `6b47a3d`. The README describes what the
board *is* and how to use it; this file is for whoever picks the work up
next — where things stand, where the levers are, and what is still open.

## Where it stands

The board is finished and working: 8 rows × 25 columns, 200 drums, on a
fixed 1920 × 1080 stage. Compose, the tile painter, sequences and the
time-of-day schedule all work, settings persist, and the whole thing is one
file with no build step, no dependencies and no network calls.

Everything lives on branch `claude/retro-tile-sign-board-xvgxir`, open as
PR #2 against `claude/edm-production-engine-2penx6` (this repository has no
`main`). The repository runs no CI, so there are no checks to go green —
the bar is a clean merge, which it has.

## Changing the grid

`COLS` and `ROWS` at the top of the geometry section are the only place the
grid size is written down. Everything else derives from them:

* tile and board dimensions, and the centring of the board on the stage
* the composer's width and the tile painter's columns, through `--cols` on
  the root, which `applyGridMetrics()` re-asserts at boot
* the window title, the panel header and the compose label, written from
  the constants rather than typed in
* the ruler, the per-row counters and the red overflow tint, which already
  read `COLS`

`fitMatrix()` crops or blank-pads any stored matrix to the current grid
before anything indexes into it, so boards painted on an older grid still
load. It runs on load and at every point a sequence or schedule entry
reaches the board. Keep that property if you touch those paths: `setBoard()`
indexes `matrix[r][c]` directly and will throw on a short row.

One constraint worth knowing before resizing: **the grid is width-bound.**
Tiles are sized from the stage width and their height follows from the 1.42
aspect ratio, so adding columns makes the tiles shorter and gives height
back. At 25 × 8 the enclosure is 877px inside the 1080px frame, leaving a
101px band above and below. That band cannot be closed by adding columns.
Filling 1080 exactly at 25 columns would need a tile aspect near 1.76, which
is far taller than a real split-flap tile.

## The levers

Motion, in the timing section:

* `settings.stepMs` — flap period at speed (20 flaps a second)
* `FINAL_FLAP_MS` — the last flap of a journey (6 a second)
* `EASE_FLAPS` and `EASE_SHARE` — how long the wind-down is, capped at a
  share of each drum's journey so a short journey still runs at speed first
* `TAIL_TILES` and `TAIL_MS` — the few drums held back, which is what makes
  the end of a change countable

Sound: gains and the thunk level sit in the audio section. Playback rate is
fixed at 1 on purpose — what varies across a change is the rate of clicking,
never the pitch.

Type: `GLYPHS` holds 56 hand-drawn glyphs as SVG path data on a 100 × 140
unit grid. Crossbars sit at y 58, above the seam at y 70, so they are not
swallowed by the split. `miterLimit` is 2, which bevels acute joins and
gives `A M N V W` a flat-cut apex.

## Rebuilding the sounds

`tools/recordings/` holds the two source recordings the samples come from.
`tools/make-clicks-from-recordings.py` rebuilds the WAV data that is baked
into `index.html`. Processing is deliberately light — the scrape and ring of
a real strike is what makes it sound like a mechanism. Loudness across the
six strikes is pulled to about 3.9 dB apart: near enough identical to be one
mechanism, different enough never to hear a loop.

`tools/make-clicks.py` is a fully synthesised alternative, kept as a
fallback. It is not what ships.

## Open, and not to be decided unilaterally

The owner is hosting `index.html` on a subdomain. Configuration lives in the
browser's own storage, so opening the URL on a phone gives a separate copy
rather than a remote control for a wall display. How the two should connect
is **the owner's decision and is deliberately deferred** — the options on the
table were a hosted store for live sync, config packed into a link or QR
code with no backend, or leaving it same-device-only. Do not build any of
them unasked.

Unpicked backlog: import/export of sequences; grid undo; typing straight
onto the board.

## Environment notes

* *Export PNG* works locally but is inert inside a hosted Artifact, which
  grants pages no download permission.
* Deleting a remote branch over the agent proxy returns 403, and the GitHub
  MCP server has no delete-branch tool. The stale branch
  `claude/digital-vesta-board-xvgxir` (at `be191b5`) still needs removing by
  hand.
* Frame rate was last measured with a browser launched with the compositor's
  frame cap lifted; with the cap on, a headless run reports ~30 fps whatever
  the board is doing, which is the cap and not the board.
