#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JT="${JT:-/home/kreijstal/git/java-tools}"
CFR="${CFR:-$ROOT/lib/cfr.jar}"
cd "$ROOT"
for name in ChessFlagBad ChessFlagUShapeBad ChessFlagUShapeFixed; do
  node "$JT/scripts/jvm-cli.js" assemble "reductions/chess-flag/$name.j" --out "reductions/chess-flag/$name.class" >/dev/null
  rm -rf "reductions/chess-flag/cfr-$name"
  java -jar "$CFR" "reductions/chess-flag/$name.class" --outputdir "reductions/chess-flag/cfr-$name" >/dev/null 2>&1 || true
  markers=$((grep -RhcE '\*\* GOTO|Unable to fully structure code|lbl-1000|Exception decompiling' "reductions/chess-flag/cfr-$name" 2>/dev/null || true) | awk '{s+=$1} END{print s+0}')
  printf "%-22s %s marker(s)\n" "$name" "$markers"
done
