#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEKOB_DIR="$(dirname "$SCRIPT_DIR")"
GAMES_DIR="${1:-$DEKOB_DIR/.work/games}"
PIPELINE_TIMEOUT_SECONDS="${PIPELINE_TIMEOUT_SECONDS:-900}"
CFR_TIMEOUT_SECONDS="${CFR_TIMEOUT_SECONDS:-300}"

if [[ ! -d "$GAMES_DIR/classes" && ! -d "$GAMES_DIR" ]]; then
  echo "FATAL: missing games directory: $GAMES_DIR" >&2
  exit 2
fi

if [[ -d "$GAMES_DIR/classes" ]]; then
  GAME_DIRS=("$GAMES_DIR")
else
  shopt -s nullglob
  GAME_DIRS=("$GAMES_DIR"/*)
  shopt -u nullglob
fi

for game_dir in "${GAME_DIRS[@]}"; do
  classes_dir="$game_dir/classes"
  [[ -d "$classes_dir" ]] || continue
  game="$(basename "$game_dir")"
  work="$game_dir/deob-safe"
  out="$work/out"
  cfr="$work/cfr"
  logs="$work/logs"

  echo "==> $game"
  rm -rf "$work"
  mkdir -p "$out" "$cfr" "$logs"

  if ! JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-/home/kreijstal/git/java-tools}" \
    timeout "$PIPELINE_TIMEOUT_SECONDS" \
    node "$DEKOB_DIR/scripts/pipeline/bulk-pipeline.js" \
      "$classes_dir" "$out" --profile none --safe-bytecode \
      > "$logs/pipeline.log" 2>&1; then
    echo "FATAL: $game pipeline failed or timed out after ${PIPELINE_TIMEOUT_SECONDS}s" >&2
    exit 1
  fi

  mapfile -d '' class_files < <(find "$out" -type f -name '*.class' -print0)
  if (( ${#class_files[@]} == 0 )); then
    echo "FATAL: $game produced no .class files" >&2
    exit 1
  fi
  timeout "$CFR_TIMEOUT_SECONDS" \
    java -jar "$DEKOB_DIR/lib/cfr.jar" "${class_files[@]}" \
    --outputdir "$cfr" --silent true --caseinsensitivefs false \
    > "$logs/cfr.log" 2>&1 || true

  rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' "$cfr" \
    > "$logs/cfr-markers.txt" || true

  gotos="$(grep -c '\*\* GOTO' "$logs/cfr-markers.txt" || true)"
  unable="$(grep -c 'Unable to fully structure code\|lbl-1000' "$logs/cfr-markers.txt" || true)"
  classes="$(cut -d: -f1 "$logs/cfr-markers.txt" | sort -u | wc -l)"
  printf '    gotos=%s unable=%s classes=%s\n' "$gotos" "$unable" "$classes"
done
