# ⚡ GENENGINE — Music Production Studio

**A fully-featured electronic music production engine that runs in your browser.**
No installs, no accounts, no plugins. Double-click `index.html` and make trance.

Built to feel like the best parts of the greats:

| Borrowed from | What you get |
|---|---|
| **FL Studio** | Pattern-based channel rack, step sequencer, the fast friendly piano roll, F5/F6/F7 window keys |
| **Ableton Live** | Live pattern queueing — click a pattern (or press 1-9) while playing and it switches at the next bar |
| **Logic / GarageBand** | Your Apple Loops & GarageBand sounds imported straight into the sampler |
| **Bitwig** | Automation curves you can drop anywhere, modulation-heavy FX |

---

## 🚀 Quick start (60 seconds)

1. **Open `index.html`** in Chrome, Edge or Safari (double-click the file — that's it).
2. The demo song **“First Flight”** is loaded. Press **SPACE**. 🎧
3. Press **F5** to see the song laid out in the Playlist. Press **F6** for the drum steps. **F7** for melodies.
4. Click **⬇ Export WAV** to render your track and share it with the world.

> Everything autosaves to your browser every 20 seconds. Use **💾 Save** to keep a
> `.genengine.json` project file you can back up or share.

## 🎛 The five views

- **▦ CHANNELS (F6)** — FL-style rack. Click steps to program drums. Drag up/down on a lit step for velocity. Right-click a channel name for piano roll / mixer / clone / delete. Pattern chips up top: click to switch (queues live!), right-click to rename/clone, `+` for a new one.
- **🎹 PIANO ROLL (F7)** — draw notes with the left button, drag them anywhere, grab the right edge to resize, right-click to erase, **snap down to 1/64** (plus triplet grids), paint tool for fast hat/arp runs, marquee select, velocity lane at the bottom, **S** toggles 303-style slides on selected notes, Ctrl+B duplicates.
- **📽 PLAYLIST (F5)** — paint patterns onto tracks with the brush, stretch clips to loop them, drop **automation clips** (＋ Automation) that sweep any knob: filter cutoffs, volume, pan, pitch (±24 semitones — your pitch bender), reverb/delay sends, master volume. Shift-drag the ruler to set the loop, click it to seek.
- **🎛 MIXER (F9)** — faders, meters, pan, mute/solo, two global send buses (**SPACE VERB** + **SYNC ECHO**) and per-channel FX chains.
- **📚 LIBRARY (F8)** — 30+ built-in instruments (audition with a click) and **your sample library**: drag in folders of WAV/MP3/M4A/AIFF/CAF — they persist in the browser and become sampler channels.

## 🔥 The FX arsenal

Filter (LP/HP/BP/notch + drive) · EQ Three · Distortion (tube/hard/folder/fuzz) ·
Crusher (bits + crunch) · Chorus · **Flanger** · **Phaser** · Echo Chamber (tempo-synced ping-pong) ·
Space Chamber reverb · Compressor · **Sidechain Pump** (that EDM heartbeat, no routing needed) ·
**Trance Gate** (16-step pattern gate) · **Space Bender** (drifting pitch wobble)

Chain presets get you there in one click: *Sidechain Pump, Trance Gate 16, Crunch Bus,
Ethereal Space, Dub Echoes, Danger Zone, Airline Filter, Radio Wash.*

## 🎹 Instruments

- **SuperSaw engine** — up to 7 detuned, stereo-spread oscillators (the trance anthem sound)
- **Acid engine** — resonant 303 with **slide notes** and glide
- **FM engine** — bells, space choirs, zap leads
- **Pluck / Sub / Pad engines** — ethereal light to chunky and dangerous
- **Synthesized drum kit** — 909 & 808 kicks, snare, clap, hats, ride, crash, tom, rim, zap, noise hits — all tunable per-note
- **Sampler** — any audio from your library, repitched across the keyboard
- Per-note **pitch bends** (risers/downlifters), per-channel pitch knob (automatable)

Presets include: *Rolling Trance Bass, Acid Danger 303, Chunky Space Bass, Deep Sub 808,
SuperSaw Anthem, Ethereal Light Lead, Space Age Zap, Crunchy Danger Lead, Trance Pluck,
Crystal Bell, Gated Shimmer, Ethereal Pad, Space Choir, Dark Matter, Dream Keys, Rave Stab,
Lift-Off Riser, Downlifter, Impact Boom…*

## 🍎 Using your GarageBand sounds

Your Mac already has thousands of sounds. In Finder press **⌘⇧G** and go to:

- `/Library/Audio/Apple Loops/Apple` — the big Apple Loops collection
- `~/Library/Audio/Apple Loops/User Loops` — your own saved loops
- `/Library/Application Support/GarageBand/Instrument Library/Sampler/Sampler Files` — one-shot instrument samples

Drag files (or whole folders) into **LIBRARY → drop zone**.

- **Safari** decodes `.caf` and `.aif` natively — everything just works.
- **Chrome** prefers WAV/MP3/M4A. Run the included converter once:

```bash
cd ~/Desktop/"Music GenEngine"/tools
chmod +x convert_apple_loops.sh
./convert_apple_loops.sh
```

…then import `~/Desktop/Music GenEngine/Converted Loops` from the LIBRARY tab.

## ⌨️ Shortcuts

| Key | Action |
|---|---|
| `Space` | play / pause |
| `F5 / F6 / F7 / F8 / F9` | Playlist / Channels / Piano Roll / Library / Mixer |
| `1–9` | select pattern (queues live at the next bar while playing) |
| `Z–M` and `Q–P` rows | play the current instrument (two octaves) |
| `-` / `=` | keyboard octave down / up |
| `●` record + play | live-record your keys into the pattern |
| `Ctrl+Z / Ctrl+Y` | undo / redo |
| `Ctrl+C/V/X`, `Ctrl+A`, `Ctrl+B` | copy/paste/cut, select all, duplicate (piano roll) |
| `S` | toggle 303 slide on selected notes |
| `Del` | delete selected notes |
| Arrows / Shift+↑↓ | nudge notes by grid / octave |
| `Ctrl+S / Ctrl+O` | save / open project |

## 🧠 Under the hood

- Pure vanilla JS + Web Audio API. Zero dependencies, works from `file://`.
- 96 PPQ tick engine, look-ahead scheduler, swing, tempo-synced everything.
- WAV export renders **offline** through the full mixer/FX/automation graph — bit-perfect, faster than realtime not guaranteed but always exact.
- Projects are JSON (samples embedded as base64 so a project file is portable).
- Sample library persists in IndexedDB; project autosaves to localStorage.

*Bring the music in your heart to the world. It would be selfish not to.* 💜
