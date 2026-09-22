# Digital Vestaboard

A digital split-flap message board — six rows of twenty-two flap drums, the
kind that used to clatter through the departures at a railway station, and that
Vestaboard sells as a mechanical wall piece today.

**Open `index.html` in a browser. That's the whole install.** One file, no
build step, no network, no dependencies.

---

## The board

* **6 rows × 22 columns** — 132 independent drums.
* **1920 × 1080** fixed design stage on pure black, scaled to fit whatever
  screen it lands on.
* Every drum carries the full **72-flap character set**: blanks, `A–Z`, `0–9`,
  `! @ # $ ( ) - + & = ; : ' " % , . / ? °`, and the colour flaps —
  red, orange, yellow, green, blue, violet, white, black and filled.
* Changing the board does not cut to the new message. Each drum spins *forward*
  through its flaps until it reaches the character it needs, exactly as the
  mechanism does, so a tile travelling from `Z` to `B` rolls the long way round.
  Worst case is 71 flaps, about 2.7 seconds at the default speed.
* **Every tile turns on every change.** A drum that already shows the right
  character would otherwise sit still, which makes a one-word edit look like
  nothing happened, so it takes the long way round instead — a full
  revolution back to the same flap. The whole board breaks into motion and
  settles into the new message. *Flip every tile* in Settings turns this off
  for strictly minimal, mechanically faithful travel.
* The last couple of flaps ease off as the drum settles, and each tile starts
  after a small random delay, so the board breaks into a rustle rather than
  marching in lockstep.
* The clicking is synthesised — a filtered noise burst per flap, voice-limited
  so 132 drums in motion sound like a board, not a hailstorm.

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

**Playlist** — build a sequence of messages and let the board run it.

* Entries display **in the order listed**; the arrows move one up or down.
* Each entry carries **its own hold time in seconds**, set in the field on its
  row. The default for new entries is the slider below the list.
* A hold is counted from the moment the tiles *land*, not from when they start
  turning, so a 15-second entry is readable for 15 seconds rather than spending
  most of that flipping.
* **Loop** returns to the first message after the last. Switch it off and the
  sequence plays once through and stops.
* **Shuffle** picks the next entry at random instead of in order.
* ▶ jumps straight to an entry, ✎ loads it back into Compose — edit it there,
  then press *Update* to write it back to the same slot — and × removes it.

Clock mode puts the time on the board and re-flips it as the minute turns.

**Settings** — flip speed, start stagger, volume, sound, whether every tile
turns on a change, 2× rendering, the enclosure, and PNG export.

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
| `P` | start/stop the rotation |
| `⌘/Ctrl + Enter` | send, from the compose box |

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

The character codes follow the Vestaboard map (0 blank, 1–26 `A–Z`, 27–36 the
digits `1`–`9` then `0`, punctuation above that, colours at 63–71). The gaps in
that map — 43, 45, 51, 57, 58, 61 — are real blank flaps on the drum, which is
why a tile passes through blanks partway round.

This is an independent homage. It is not affiliated with Vestaboard, and it
talks to no hardware.
