#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEKOB_DIR="$(dirname "$SCRIPT_DIR")"
BASELINE_ALL="$SCRIPT_DIR/EXPECTED-GOTO-ALL-GAMES.tsv"
BASELINE_FREE="$SCRIPT_DIR/EXPECTED-GOTO-FREE-GAMES.txt"
SCAN_DIR="${1:-$DEKOB_DIR/.work/current-goto-scan}"
SUMMARY="$SCAN_DIR/summary.tsv"

if [[ ! -f "$SUMMARY" ]]; then
  echo "FATAL: missing scan summary: $SUMMARY" >&2
  echo "Run the all-game scan first, then rerun this checker." >&2
  exit 2
fi

tmp_all="$(mktemp)"
tmp_free="$(mktemp)"
trap 'rm -f "$tmp_all" "$tmp_free"' EXIT

awk '!/^#/ && NF {print}' "$BASELINE_ALL" > "$tmp_all"
awk '!/^#/ && NF {print}' "$BASELINE_FREE" > "$tmp_free"

regressions=0
improvements=0

while IFS=$'\t' read -r game gotos unable classes; do
  [[ -z "${game:-}" ]] && continue
  expected_line="$(awk -F'\t' -v game="$game" '$1 == game {print; found=1} END {if (!found) exit 1}' "$tmp_all" || true)"
  if [[ -z "$expected_line" ]]; then
    printf "%-28s gotos=%s unable=%s classes=%s NEW-GAME\n" "$game" "$gotos" "$unable" "$classes"
    regressions=$((regressions + 1))
    continue
  fi
  IFS=$'\t' read -r _ expected_gotos expected_unable expected_classes <<< "$expected_line"
  if (( gotos > expected_gotos || unable > expected_unable || classes > expected_classes )); then
    printf "%-28s expected<=%s/%s/%s got=%s/%s/%s REGRESSION\n" \
      "$game" "$expected_gotos" "$expected_unable" "$expected_classes" "$gotos" "$unable" "$classes"
    regressions=$((regressions + 1))
  elif (( gotos < expected_gotos || unable < expected_unable || classes < expected_classes )); then
    printf "%-28s expected<=%s/%s/%s got=%s/%s/%s improved\n" \
      "$game" "$expected_gotos" "$expected_unable" "$expected_classes" "$gotos" "$unable" "$classes"
    improvements=$((improvements + 1))
  fi
done < "$SUMMARY"

while read -r game; do
  [[ -z "${game:-}" ]] && continue
  marker_file="$SCAN_DIR/$game/markers.txt"
  if [[ ! -f "$marker_file" ]]; then
    printf "%-28s missing markers.txt for GOTO-free baseline\n" "$game"
    regressions=$((regressions + 1))
    continue
  fi
  gotos="$(grep -c '\*\* GOTO' "$marker_file" || true)"
  if (( gotos != 0 )); then
    printf "%-28s expected 0 GOTO markers, got %s REGRESSION\n" "$game" "$gotos"
    regressions=$((regressions + 1))
  fi
done < "$tmp_free"

total_gotos="$(awk -F'\t' '{s += $2} END {print s + 0}' "$SUMMARY")"
total_unable="$(awk -F'\t' '{s += $3} END {print s + 0}' "$SUMMARY")"
goto_games="$(awk -F'\t' '$2 > 0 {c++} END {print c + 0}' "$SUMMARY")"

if (( regressions > 0 )); then
  echo "FAIL: $regressions regression(s), $improvements improvement(s), $total_gotos GOTO markers across $goto_games games, $total_unable unable markers"
  exit 1
fi

echo "PASS: no GOTO baseline regressions, $improvements improvement(s), $total_gotos GOTO markers across $goto_games games, $total_unable unable markers"
