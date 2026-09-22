# Retro Tile Sign Board

A digital split-flap message board — six rows of twenty-two flap drums, the
kind that used to clatter through the departures at a railway station before
the screens took over.

**Open `index.html` in a browser. That's the whole install.** One file, no
build step, no network, no dependencies.

---

## The board

* **6 rows × 22 columns** — 132 independent drums, set 4 units apart across
  and 10 down so the rows read as separate courses rather than one block.
* **1920 × 1080** fixed design stage on pure black, scaled to fit whatever
  screen it lands on.
* Every drum carries the full **72-flap character set**: blanks, `A–Z`, `0–9`,
  `! @ # $ ( ) - + & = ; : ' " % , . / ? °`, and the colour flaps —
  red, orange, yellow, green, blue, violet, white, black and filled.
* Changing the board does not cut to the new message. Each drum spins *forward*
  through its flaps until it reaches the character it needs, exactly as the
  mechanism does, so a tile travelling from `Z` to `B` rolls the long way round.
  Worst case is a full revolution of the drum, about 5.9 seconds at the
  default speed of 76 ms a flap. *Flip speed* in Settings runs from 16 ms to
  200 ms if you want it brisker or slower still.
* **Every tile turns on every change.** A drum that already shows the right
  character would otherwise sit still, which makes a one-word edit look like
  nothing happened, so it takes the long way round instead — a full
  revolution back to the same flap. The whole board breaks into motion and
  settles into the new message. *Flip every tile* in Settings turns this off
  for strictly minimal, mechanically faithful travel.
* The last couple of flaps ease off as the drum settles, and each tile starts
  after a small random delay, so the board breaks into a rustle rather than
  marching in lockstep.
* The board wakes with a **self-test**: colour bars wipe across the tiles, hold,
  and the message rolls in behind them. It is also on a button and the `B` key,
  and *Wipe & restore* (or `W`) clears the board away and brings it back.
* Changes travel rather than happening all at once. **Transition** picks the
  order the drums are released in — a cascade left to right or right to left,
  row by row, diagonally, out from the centre, in from the edges, scattered, or
  all together — and **Transition spread** sets how long the wave takes to
  cross.
* The clicking is **recorded, not synthesised**. Six strikes and one settle
  are isolated from two recordings of a real mechanical clicker, made for this
  project, and baked into the file as WAV data. Nothing is fetched from the
  network.
* The processing is deliberately light. A strike is not a clean event — it
  slides, it scrapes, it rings a little — and that mess is what makes a board
  sound like a mechanism instead of a sequencer. Each hit is windowed to the
  gap before the next so no neighbour bleeds in, gently band-limited, and given
  a soft decay well after the strike itself; the natural tail survives.
  `tools/make-clicks-from-recordings.py` rebuilds them from
  `tools/recordings/`.
* The strikes keep their own loudness, but only just. Off the recording they
  ran 20 dB apart, which reads as six different sounds; they are pulled to
  about **4 dB** apart, near enough identical to be one mechanism, different
  enough never to hear a loop.
* **Pitch is held constant.** Playback rate stays at 1, so what varies across a
  change is the rate of clicking, never the note. The variety comes from the
  six different strikes and a little gain scatter.
* **No two drums turn at quite the same rate.** Each is given its own drag
  when a change starts, and no single flap takes quite the same time as the
  last, so the board spans about a 22 per cent spread between its slowest and
  fastest drum. Without it 132 tiles move as one machine.
* The wind-down is **sized to each drum's own journey**, never more than about
  half of it. A drum with only a few flaps to travel would otherwise spend its
  whole trip inside the deceleration and never run at speed at all.
* Each drum runs at **20 clicks a second** at speed and **winds down over its
  last 22 flaps — about two seconds — to 6 a second**, so a change ends on
  clicks you can count rather than a burst cutting off. A few drums are held
  back and arrive one at a time after the rest, which is what thins the tail:
  one drum alone is already about eight clicks a second, so the only way the
  end becomes countable is for nearly all of them to have stopped.

## The control panel

The menu button, top right, slides the panel in. `M` toggles it, `Esc` closes.

**Compose** — type the message. A column ruler and a per-row counter sit around
the box. Auto-fit wraps on word boundaries across the six rows; literal mode
treats each typed line as one row. Horizontal and vertical alignment are
independent. Colour chips insert tokens at the caret. Messages can be saved by
name.

**Grid** — a 22 × 6 painter for placing individual tiles. Pick a character or
colour from the palette and tap, or drag to paint a run. *Read board* pulls
whatever is currently displayed into the editor.

**Playlist** — build a sequence of boards and let the board run it. An entry
can be a typed message or a board painted in the Grid, and the two mix freely
in one sequence.

* Entries display **in the order listed**; the arrows move one up or down.
* *Add current message* takes what is in Compose; *Add current board* takes
  whatever the board is showing, tile for tile, including anything painted in
  the Grid. The Grid tab has its own *Add to sequence* for the board being
  painted there.
* Each entry carries **its own hold time in seconds**, set in the field on its
  row. The default for new entries is the slider below the list.
* A hold is counted from the moment the tiles *land*, not from when they start
  turning, so a 15-second entry is readable for 15 seconds rather than spending
  most of that flipping.
* **Loop** returns to the first message after the last. Switch it off and the
  sequence plays once through and stops.
* **Shuffle** picks the next entry at random instead of in order.
* ▶ jumps straight to an entry, ✎ opens it for editing — a message in Compose,
  a painted board in the Grid — and *Update* writes it back to the same slot.
  × removes it.

Clock mode puts the time on the board and re-flips it as the minute turns.

**Settings** — flip speed, transition pattern and spread, the two wipes, volume,
sound, the startup self-test, whether every tile turns on a change, 2×
rendering, the enclosure, and PNG export.

### Tokens

| Token | Gives you |
|---|---|
| `{red}` `{orange}` `{yellow}` `{green}` `{blue}` `{violet}` `{white}` `{black}` `{filled}` | one colour flap |
| `{blank}` | one blank flap |
| `{deg}` | the degree sign |
| `{time}` `{time24}` | the current time, 12- or 24-hour |
| `{day}` `{date}` | the weekday, and the date |

Lowercase is folded to uppercase. Curly quotes, en/em dashes and a few other
near-misses are mapped to the nearest flap the drum actually carries; anything
genuinely absent becomes a blank, and the board says how many were dropped.

## Export

*Export PNG* writes the board at exactly **1920 × 1080**, with the PNG `pHYs`
chunk set to 11811 pixels per metre — **300 DPI** — so it arrives in print
software at the right physical size (6.4″ × 3.6″) rather than at 72 DPI.

## Keyboard

| Key | |
|---|---|
| `M` | control panel |
| `Esc` | close the panel |
| `F` | fullscreen |
| `R` | re-flip the current message |
| `B` | run the self-test wipe |
| `W` | wipe the board away and back |
| `P` | start/stop the rotation |
| `⌘/Ctrl + Enter` | send, from the compose box |

## The typeface

The characters are not a system font. They are a **monoline condensed
grotesque drawn for this board**, 56 glyphs authored as stroked skeletons on a
fixed grid and rendered as vector paths, which is what the mechanical boards
carry and what survives being cut in half by the seam.

Two decisions are worth knowing about:

* The crossbars of `E`, `F` and `H` sit **above** the seam rather than on it.
  A bar landing exactly on the split disappears into it, so the face puts them
  clear — which is what gives split-flap lettering its slightly top-heavy
  look.
* Acute joins **bevel rather than mitre**, so `A`, `M`, `N`, `V` and `W` get a
  flat-cut apex instead of a long spike. That is correct for a condensed
  grotesque at this weight, and it is what the joins would do in metal.

Each glyph lives in `GLYPHS` in `index.html` as SVG path data on a 100 × 140
unit grid: cap box `x 12..88, y 14..126`, crossbar at `y 58`, stroke 24 units
with a per-glyph override for the busy ones. Edit a path there and the whole
board picks it up. If a browser ever cannot parse `Path2D` path data, the
board falls back to the system face on its own.

## Display

Built for a desktop screen. The board holds a 16:9 stage and scales to fill
whatever window it is given, so it works full-screen on a monitor or in a
window alongside other things, and `F` goes fullscreen.

**Retina rendering** follows your display: on a HiDPI screen it renders into a
2× backing store so the tiles stay sharp, and on a 1× screen it does not
bother. That is four times the pixels to fill, which is free on any machine
with a GPU-accelerated canvas and not free on one without — the switch in
Settings overrides the default in either direction. Turning it off costs
sharpness, never speed of the animation itself: the flip is driven by elapsed
time, so a slower machine shows fewer frames rather than a slower board.

## Rebuilding the sounds

`tools/make-clicks.py` regenerates the embedded audio. It needs nothing but the
Python standard library, and prints the base64 block to paste over `CLICK_WAV`
and `THUNK_WAV` in `index.html`. Edit the modal frequencies and decay times in
`synth()` to change the character of the board — longer decays and lower modes
give a heavier flap; raising them, or moving the ratios towards whole numbers,
takes it back towards wood.

## Notes on the rendering

The board is one canvas, not 132 elements. Each of the 72 flaps is drawn once
into a sprite sheet built at the exact scale it will be blitted at, so painting
a tile is a 1:1 pixel copy rather than a resample — that alone was the
difference between 13 and 59 frames a second on a software rasteriser. The
enclosure, with its wide drop shadow, is rendered once and kept. While the
drums turn, only the tiles that are actually moving are repainted, each patched
back from the cached background first.

## Notes

Messages, saved presets, the playlist and all settings persist in
`localStorage`, so the board comes back as you left it. *Reset everything* in
Settings clears it.

The character codes follow the layout these 22 × 6 boards conventionally use:
0 blank, 1–26 `A–Z`, 27–36 the digits `1`–`9` then `0`, punctuation above that,
colours at 63–71. The gaps in that map — 43, 45, 51, 57, 58, 61 — are real
blank flaps on the drum, which is why a tile passes through blanks partway
round.

This is an independent piece of software. It is not affiliated with, endorsed
by, or compatible with any commercial split-flap product or manufacturer, and
it talks to no hardware.
