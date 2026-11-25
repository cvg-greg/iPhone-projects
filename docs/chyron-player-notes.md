# Chyron player — concept notes

Working notes from the planning discussion. Nothing is built yet.

## What it is

A player that takes a pre-recorded video, lays broadcast-style graphics over
it on cue, and exports the result as a single MP4 or MOV. The finished file
plays anywhere and can be dropped into iMovie as an ordinary clip.

## Workflow

1. Load the pre-recorded main video.
2. Build the library (see sections below).
3. Preview the video and flag where each item comes on and goes off, either
   by pausing and placing flags or by tapping them in during playback.
4. Play back to check the cues.
5. Export: render video, frame and graphics into one file.

Export renders from the saved flags; it does not screen-record the playback.
A wrong cue or typo is fixed by editing that flag and exporting again.

The library and flags are saved as a project so a graphics set can be reused
across episodes.

## Scope

The intent is to include everything listed here. The build order at the end
only sequences the work; it does not drop anything.

## Control panel sections

- **Chyrons:** lower thirds, title cards, tickers, logo bugs, built from
  templates.
- **Insets (over-the-shoulder):** headshot, logo, photo or map in a styled
  box with an optional caption. Can be up at the same time as a chyron.
- **Video clips:** imported clips shown as their own section beside the
  chyrons, cued the same way, so video content can be spliced into the
  programme.
- **Full-screen graphics:** see below.
- **Audio:** stings, music beds, sound effects.

## Video clips

All three behaviours are wanted:

- **Splice:** the main video pauses, the clip plays in full with its own
  audio, then the main video resumes. The programme gets longer.
- **Cutaway:** the clip covers the picture while the main video's audio
  continues underneath (B-roll). Length is unchanged.
- **Inset:** the clip plays inside the over-the-shoulder box.

Also:

- Trim the start and end of each clip.
- Per-clip volume and mute.
- Chyrons can appear over a clip as well as over the main video.
- Still images usable as full-screen cutaways, with optional slow pan/zoom.

## Graphics types

- Lower thirds: name and title, one line or two, with optional logo.
- Ticker / crawl along the bottom, with editable headline list.
- Corner bug: logo, "LIVE", "BREAKING", episode number.
- Clock, date and location line.
- Over-the-shoulder insets (image, map or video).
- Full-screen cards: opening title, section title, quote, bullet list,
  statistic, contact details, end credits roll.
- Countdown timer and "coming up next" card.
- Scoreboard / two-sided tally.
- Locator maps: imported images first; generated region-with-pin maps and
  animated maps (zooms, routes) after.
- Captions / subtitles: import a subtitle file, or generate from the audio.

## Layouts

- Graphics over full-frame video.
- Video shrunk into a frame with graphics around it, for footage framed too
  tight to leave room for an inset.
- Double box: two videos side by side with name labels (interview look).
- Picture-in-picture.
- Vertical or square footage placed in a wide frame with a blurred or branded
  background fill.
- Output shapes: wide (16:9), vertical (9:16) and square (1:1), with the
  graphics re-flowing to fit.
- Title-safe guides in the preview.

## Transitions

- Per-item animation in and out: cut, fade, slide, wipe.
- Between video sources: cut, dissolve, wipe, and a branded stinger
  (short animated logo transition).

## Look and branding

- Brand kit: colours, fonts, logo, applied across every template.
- Several built-in themes (news, sports, podcast, corporate).
- Template editor for adjusting size, position and style.
- Export and import of a graphics set so it can be shared or backed up.

## Cueing and editing

- Timeline view showing every flag, draggable to retime.
- Live tap-in mode during playback, plus pause-and-place mode.
- Keyboard shortcuts / hotkeys for each library item.
- Queue: line up the next item and fire it with one key.
- Rundown: an ordered list of the show's items; import names and titles
  from a spreadsheet to create chyrons in bulk.
- Undo / redo.
- Snap flags to the nearest second or to scene changes.
- Phone or tablet as a remote control for firing cues.

## Audio

- Original track passed through.
- Stings and sound effects attached to a graphic or fired on their own.
- Music bed with automatic lowering under speech.
- Level meters and per-source volume.

## Export

- MP4 or MOV, 1080p or 4K, choice of frame rate.
- Presets for common destinations (YouTube, vertical social, podcast video).
- Graphics-only export with transparency, for use in other editors.
- Chapter markers taken from section titles.
- Thumbnail image export.
- Handles phone footage correctly: rotation, HDR, variable frame rate.

## Later

- Live camera input in place of a pre-recorded file, recording or streaming
  in real time.

## Suggested build order

1. Core: load video, lower thirds, flags, preview, export to one file.
2. Insets, ticker, bug, full-screen cards, brand kit.
3. Video clips (splice, cutaway, inset), transitions, audio stings.
4. Timeline editing, rundown and spreadsheet import, hotkeys.
5. Extra layouts and output shapes, captions, music bed.
6. Generated maps, remote control, graphics-only export.
7. Live input.

## Open decisions

- Platform: native iPhone/iPad/Mac app, or a browser-based tool for a first
  version.
