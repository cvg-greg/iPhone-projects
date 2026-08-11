#!/bin/bash
# ============================================================
# GENENGINE — convert_apple_loops.sh   (v2 — GarageBand harvest)
#
# Finds every audio file GarageBand ships — loops, sampler
# instruments, drum samples — across ALL the places Apple hides
# them, including inside the app bundle itself:
#
#   /Applications/GarageBand.app/Contents
#   /Library/Application Support/GarageBand     (Instrument Library)
#   /Library/Application Support/Logic          (shared sound content)
#   /Library/Audio/Apple Loops/Apple            (the big loop collection)
#   ~/Library/Audio/Apple Loops                 (your own saved loops)
#
# …and converts them all to 44.1 kHz 16-bit WAV that every browser
# can load into your GENENGINE library.
#
# Usage (Terminal on your Mac):
#   chmod +x convert_apple_loops.sh
#   ./convert_apple_loops.sh                    # scan every standard location found
#   ./convert_apple_loops.sh "/some/folder"     # scan just the folder(s) you give it
#
# Output:  ~/Desktop/Music GenEngine/GarageBand Sounds/<source>/…
# Then open GENENGINE → LIBRARY → "Import folder…" and pick that
# folder (subfolders are included automatically).
#
# Uses afconvert, which ships with every Mac — nothing to install.
# Re-running skips files already converted, so it's safe to repeat.
# ============================================================
set -o pipefail

OUT="$HOME/Desktop/Music GenEngine/GarageBand Sounds"

if ! command -v afconvert >/dev/null 2>&1; then
  echo "afconvert not found — this script is meant to run on macOS."
  echo "(On other systems, install ffmpeg and convert manually, e.g.:"
  echo "  ffmpeg -i loop.caf -ar 44100 -sample_fmt s16 loop.wav)"
  exit 1
fi

# ---------- sources ----------
if [ $# -ge 1 ]; then
  SOURCES=""
  for a in "$@"; do
    if [ -d "$a" ]; then
      SOURCES="$SOURCES
$a"
    else
      echo "  (skipping — not a folder: $a)"
    fi
  done
else
  SOURCES=""
  for c in \
    "/Applications/GarageBand.app/Contents" \
    "/Library/Application Support/GarageBand" \
    "/Library/Application Support/Logic" \
    "/Library/Audio/Apple Loops/Apple" \
    "$HOME/Library/Audio/Apple Loops" \
  ; do
    [ -d "$c" ] && SOURCES="$SOURCES
$c"
  done
fi

if [ -z "$(printf '%s' "$SOURCES" | tr -d '[:space:]')" ]; then
  echo "No GarageBand content folders found."
  echo "Pass one explicitly:  ./convert_apple_loops.sh \"/path/to/sounds\""
  exit 1
fi

mkdir -p "$OUT"

# short label for a source path, used as the output subfolder name
label_for() {
  case "$1" in
    "/Applications/GarageBand.app/Contents") echo "App Bundle" ;;
    "/Library/Application Support/GarageBand") echo "Instrument Library" ;;
    "/Library/Application Support/Logic") echo "Logic Content" ;;
    "/Library/Audio/Apple Loops/Apple") echo "Apple Loops" ;;
    "$HOME/Library/Audio/Apple Loops") echo "My Loops" ;;
    *) basename "$1" | tr '/:' '--' ;;
  esac
}

echo "Harvesting GarageBand audio into:"
echo "  $OUT"
echo

printf '%s\n' "$SOURCES" | while IFS= read -r SRC; do
  [ -z "$SRC" ] && continue
  LABEL="$(label_for "$SRC")"
  DEST="$OUT/$LABEL"
  mkdir -p "$DEST"
  echo "── Scanning: $SRC"
  ok=0; skip=0; fail=0

  # find all audio Apple ships in this tree
  find "$SRC" \
      \( -iname '*.caf' -o -iname '*.aif' -o -iname '*.aiff' \
         -o -iname '*.wav' -o -iname '*.m4a' -o -iname '*.aac' \) \
      -type f -print0 2>/dev/null |
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    stem="${base%.*}"
    wav="$DEST/$stem.wav"
    # dedupe name collisions from different subfolders
    n=2
    while [ -e "$wav" ]; do
      # already converted this exact source file? skip re-doing work
      if [ "$wav" -nt "$f" ]; then break; fi
      wav="$DEST/$stem ($n).wav"
      n=$((n+1))
    done
    if [ -e "$wav" ] && [ "$wav" -nt "$f" ]; then
      skip=$((skip+1))
      continue
    fi
    if afconvert -f WAVE -d LEI16@44100 "$f" "$wav" 2>/dev/null; then
      ok=$((ok+1))
      if [ $((ok % 100)) -eq 0 ]; then echo "   …$ok converted"; fi
    else
      fail=$((fail+1))
    fi
  done
  echo "   done: converted new files into \"$DEST\""
done

echo
echo "✅ Harvest complete."
echo
echo "Next: open GENENGINE → LIBRARY tab → 'Import folder…' and choose:"
echo "  $OUT"
echo "(or drag that folder onto the drop zone — subfolders come along automatically)"
echo
echo "Tip: the Apple Loops set alone can be several thousand files. If the"
echo "browser import feels heavy, import one subfolder at a time — e.g."
echo "\"$OUT/Apple Loops\"."
