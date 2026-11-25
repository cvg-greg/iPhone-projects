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

## Control panel sections

- **Chyrons:** lower thirds, title cards, tickers, logo bugs, built from
  templates.
- **Insets (over-the-shoulder):** headshot, logo, photo or map in a styled
  box with an optional caption. Can be up at the same time as a chyron.
- **Video clips:** imported clips shown as their own section beside the
  chyrons, cued the same way, so video content can be spliced into the
  programme.

## Video clips — behaviours to support

- **Splice:** the main video pauses, the clip plays in full with its own
  audio, then the main video resumes. The programme gets longer.
- **Cutaway:** the clip covers the picture while the main video's audio
  continues underneath (B-roll). Length is unchanged.
- **Inset:** the clip plays inside the over-the-shoulder box.

Chyrons should be able to appear over a clip as well as over the main video.

## Layout

- Graphics over full-frame video, or
- Video shrunk into a frame with graphics around it, for footage framed too
  tight to leave room for an inset.

## Later / not in a first version

- Generated locator maps (region outline, pin, label).
- Animated maps (zooms, routes).
- Live camera input in place of a pre-recorded file.
- Extra audio: stings and music beds mixed with the original track.

## Open decisions

- Platform: native iPhone/iPad/Mac app, or a browser-based tool for a first
  version.
