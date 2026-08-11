#!/bin/bash
# ============================================================
# GENENGINE — convert_apple_loops.sh
# Batch-converts GarageBand / Apple Loops (.caf / .aif) to WAV
# so every browser can load them into your GENENGINE library.
#
# Usage (in Terminal on your Mac):
#   ./convert_apple_loops.sh                       # converts the standard Apple Loops folder
#   ./convert_apple_loops.sh "/some/folder"        # converts any folder you point it at
#
# Output goes to:  ~/Desktop/Music GenEngine/Converted Loops
# Then drag that folder into GENENGINE's LIBRARY tab. Done.
#
# (Uses afconvert, which ships with every Mac — nothing to install.)
# ============================================================
set -euo pipefail

SRC="${1:-/Library/Audio/Apple Loops/Apple}"
OUT="$HOME/Desktop/Music GenEngine/Converted Loops"

if [ ! -d "$SRC" ]; then
  echo "Source folder not found: $SRC"
  echo "Tip: pass a folder, e.g.  ./convert_apple_loops.sh \"$HOME/Library/Audio/Apple Loops/User Loops\""
  exit 1
fi

mkdir -p "$OUT"
count=0
skipped=0

echo "Converting loops from: $SRC"
echo "            into: $OUT"
echo

find "$SRC" \( -iname '*.caf' -o -iname '*.aif' -o -iname '*.aiff' \) -print0 |
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  wav="$OUT/${base%.*}.wav"
  if [ -f "$wav" ]; then
    skipped=$((skipped+1))
    continue
  fi
  if afconvert -f WAVE -d LEI16@44100 "$f" "$wav" 2>/dev/null; then
    count=$((count+1))
    printf '  ✔ %s\n' "${base%.*}.wav"
  else
    printf '  ✖ could not convert %s\n' "$base"
  fi
done

echo
echo "Done! Open GENENGINE → LIBRARY tab → 'Import folder…' and pick:"
echo "  $OUT"
