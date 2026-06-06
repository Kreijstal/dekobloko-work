#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEKOB_DIR="$(dirname "$SCRIPT_DIR")"
BASELINE_ALL="$SCRIPT_DIR/EXPECTED-GOTO-ALL-GAMES.tsv"
BASELINE_FREE="$SCRIPT_DIR/EXPECTED-GOTO-FREE-GAMES.txt"
GAMES_DIR="${1:-$DEKOB_DIR/.work/games}"

if [[ ! -d "$GAMES_DIR" ]]; then
  echo "FATAL: missing games directory: $GAMES_DIR" >&2
  exit 2
fi

tmp_all="$(mktemp)"
tmp_free="$(mktemp)"
tmp_summary="$(mktemp)"
trap 'rm -f "$tmp_all" "$tmp_free" "$tmp_summary"' EXIT

awk '!/^#/ && NF {print}' "$BASELINE_ALL" > "$tmp_all"
awk '!/^#/ && NF {print}' "$BASELINE_FREE" > "$tmp_free"

while IFS=$'\t' read -r game _expected_gotos _expected_unable _expected_classes; do
  marker_file="$GAMES_DIR/$game/deob-safe/logs/cfr-markers.txt"
  if [[ ! -f "$marker_file" ]]; then
    printf '%s\tMISSING\tMISSING\tMISSING\n' "$game" >> "$tmp_summary"
    continue
  fi
  gotos="$(grep -c '\*\* GOTO' "$marker_file" || true)"
  unable="$(grep -c 'Unable to fully structure code\|lbl-1000' "$marker_file" || true)"
  classes="$(cut -d: -f1 "$marker_file" | sort -u | wc -l)"
  printf '%s\t%s\t%s\t%s\n' "$game" "$gotos" "$unable" "$classes" >> "$tmp_summary"
done < "$tmp_all"

regressions=0
improvements=0

while IFS=$'\t' read -r game gotos unable classes; do
  [[ -z "${game:-}" ]] && continue
  if [[ "$gotos" == "MISSING" ]]; then
    printf "%-28s missing deob-safe/logs/cfr-markers.txt\n" "$game"
    regressions=$((regressions + 1))
    continue
  fi
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
done < "$tmp_summary"

while read -r game; do
  [[ -z "${game:-}" ]] && continue
  marker_file="$GAMES_DIR/$game/deob-safe/logs/cfr-markers.txt"
  if [[ ! -f "$marker_file" ]]; then
    printf "%-28s missing cfr-markers.txt for GOTO-free baseline\n" "$game"
    regressions=$((regressions + 1))
    continue
  fi
  gotos="$(grep -c '\*\* GOTO' "$marker_file" || true)"
  if (( gotos != 0 )); then
    printf "%-28s expected 0 GOTO markers, got %s REGRESSION\n" "$game" "$gotos"
    regressions=$((regressions + 1))
  fi
done < "$tmp_free"

total_gotos="$(awk -F'\t' '$2 != "MISSING" {s += $2} END {print s + 0}' "$tmp_summary")"
total_unable="$(awk -F'\t' '$3 != "MISSING" {s += $3} END {print s + 0}' "$tmp_summary")"
goto_games="$(awk -F'\t' '$2 != "MISSING" && $2 > 0 {c++} END {print c + 0}' "$tmp_summary")"

if (( regressions > 0 )); then
  echo "FAIL: $regressions regression(s), $improvements improvement(s), $total_gotos GOTO markers across $goto_games games, $total_unable unable markers"
  exit 1
fi

echo "PASS: no GOTO baseline regressions, $improvements improvement(s), $total_gotos GOTO markers across $goto_games games, $total_unable unable markers"
