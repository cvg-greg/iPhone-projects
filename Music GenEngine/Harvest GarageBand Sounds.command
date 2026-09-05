#!/bin/bash
# ============================================================
# ⚡ GENENGINE — Harvest GarageBand Sounds  (double-click me!)
#
# First time macOS may say it's from an unidentified developer:
#   right-click this file → Open → Open. That's it.
# (If double-clicking says "not executable": open Terminal, type
#  bash + a space, drag this file into the window, press Return.)
#
# What it does: finds every audio file GarageBand ships — loops,
# sampler instruments, drum kits — across all the places Apple
# keeps them, including inside the app bundle itself:
#
#   /Applications/GarageBand.app/Contents
#   /Library/Application Support/GarageBand
#   /Library/Application Support/Logic
#   /Library/Audio/Apple Loops/Apple
#   ~/Library/Audio/Apple Loops
#
# …converts them to WAV with your Mac's built-in afconvert, and
# collects them in:  ~/Desktop/Music GenEngine/GarageBand Sounds
# then opens that folder in Finder.
#
# Last step (in GENENGINE): LIBRARY → "Import folder…" → pick it.
#
# Safe to re-run any time — already-converted files are skipped.
# ============================================================
set -o pipefail

echo ""
echo "  ⚡ GENENGINE — GarageBand sound harvest"
echo "  ======================================"
echo ""

OUT="$HOME/Desktop/Music GenEngine/GarageBand Sounds"

if ! command -v afconvert >/dev/null 2>&1; then
  echo "  afconvert not found — this script needs macOS."
  echo ""
  read -r -p "  Press Return to close… " _
  exit 1
fi

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

if [ -z "$(printf '%s' "$SOURCES" | tr -d '[:space:]')" ]; then
  echo "  No GarageBand content folders found on this Mac."
  echo "  (Is GarageBand installed? Open it once so it downloads its sounds.)"
  echo ""
  read -r -p "  Press Return to close… " _
  exit 1
fi

mkdir -p "$OUT"

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

echo "  Harvesting into: $OUT"
echo "  (thousands of files is normal — go make a coffee ☕)"
echo ""

printf '%s\n' "$SOURCES" | while IFS= read -r SRC; do
  [ -z "$SRC" ] && continue
  LABEL="$(label_for "$SRC")"
  DEST="$OUT/$LABEL"
  mkdir -p "$DEST"
  echo "  ── Scanning: $SRC"
  ok=0

  find "$SRC" \
      \( -iname '*.caf' -o -iname '*.aif' -o -iname '*.aiff' \
         -o -iname '*.wav' -o -iname '*.m4a' -o -iname '*.aac' \) \
      -type f -print0 2>/dev/null |
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    stem="${base%.*}"
    wav="$DEST/$stem.wav"
    n=2
    while [ -e "$wav" ]; do
      if [ "$wav" -nt "$f" ]; then break; fi
      wav="$DEST/$stem ($n).wav"
      n=$((n+1))
    done
    if [ -e "$wav" ] && [ "$wav" -nt "$f" ]; then
      continue
    fi
    if afconvert -f WAVE -d LEI16@44100 "$f" "$wav" 2>/dev/null; then
      ok=$((ok+1))
      if [ $((ok % 200)) -eq 0 ]; then echo "     …$ok converted"; fi
    fi
  done
  echo "     ✔ done → \"$DEST\""
done

echo ""
echo "  ✅ Harvest complete!"
echo ""
echo "  Opening the folder in Finder…"
open "$OUT" 2>/dev/null

echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │  LAST STEP — in GENENGINE:                          │"
echo "  │                                                     │"
echo "  │   LIBRARY tab → 'Import folder…' → pick             │"
echo "  │   Desktop → Music GenEngine → GarageBand Sounds     │"
echo "  │                                                     │"
echo "  │   (or import one subfolder at a time if the full    │"
echo "  │    set feels heavy — Apple Loops alone is huge)     │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""
read -r -p "  Press Return to close… " _
