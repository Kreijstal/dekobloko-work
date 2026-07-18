#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEKOB_DIR="$(dirname "$SCRIPT_DIR")"
BASELINE_ALL="$SCRIPT_DIR/EXPECTED-GOTO-ALL-GAMES.tsv"
BASELINE_FREE="$SCRIPT_DIR/EXPECTED-GOTO-FREE-GAMES.txt"

RAW_INPUT="${1:-$DEKOB_DIR/.work/games}"

if [[ -z "${RAW_INPUT:-}" ]]; then
  echo "FATAL: empty games argument" >&2
  exit 2
fi

resolve_target() {
  local input="$1"
  local candidate="$input"
  local game_name=""

  # Direct game directory with extracted classes
  if [[ -d "$candidate/classes" ]]; then
    if [[ -z "${candidate##*/}" ]]; then
      return 1
    fi
    games_dir="$(dirname "$candidate")"
    game_name="$(basename "$candidate")"
    echo "$games_dir|$game_name"
    return 0
  fi

  # Direct game directory with prior run output
  if [[ -f "$candidate/deob-safe/logs/cfr-markers.txt" ]]; then
    games_dir="$(dirname "$candidate")"
    game_name="$(basename "$candidate")"
    echo "$games_dir|$game_name"
    return 0
  fi

  # Directly on deob-safe/logs output directories
  if [[ -f "$candidate/logs/cfr-markers.txt" ]]; then
    local game_dir
    game_dir="$(dirname "$candidate")"
    if [[ -d "$game_dir" ]]; then
      games_dir="$(dirname "$game_dir")"
      game_name="$(basename "$game_dir")"
      echo "$games_dir|$game_name"
      return 0
    fi
  fi
  if [[ -f "$candidate/cfr-markers.txt" ]]; then
    local game_dir
    game_dir="$(dirname "$candidate")"
    if [[ -d "$game_dir" ]]; then
      games_dir="$(dirname "$game_dir")"
      game_name="$(basename "$game_dir")"
      echo "$games_dir|$game_name"
      return 0
    fi
  fi

  # Shorthand: a single game name under .work/games
  if [[ -d "$DEKOB_DIR/.work/games/$input" ]]; then
    candidate="$DEKOB_DIR/.work/games/$input"
    if [[ -d "$candidate/classes" ]]; then
      games_dir="$DEKOB_DIR/.work/games"
      game_name="$(basename "$candidate")"
      echo "$games_dir|$game_name"
      return 0
    fi
    if [[ -f "$candidate/deob-safe/logs/cfr-markers.txt" ]]; then
      games_dir="$DEKOB_DIR/.work/games"
      game_name="$(basename "$candidate")"
      echo "$games_dir|$game_name"
      return 0
    fi
  fi

  # Games root
  if [[ -d "$candidate" ]]; then
    games_dir="$candidate"
    game_name=""
    echo "$games_dir|$game_name"
    return 0
  fi

  echo ""
  return 1
}

resolved="$(resolve_target "$RAW_INPUT" || true)"
if [[ -z "$resolved" ]]; then
  echo "FATAL: missing games directory or game: $RAW_INPUT" >&2
  exit 2
fi
GAMES_DIR="${resolved%%|*}"
TARGET_GAME="${resolved#*|}"

tmp_all="$(mktemp)"
tmp_free="$(mktemp)"
tmp_summary="$(mktemp)"
tmp_filter_all=""
tmp_filter_free=""
trap 'rm -f "$tmp_all" "$tmp_free" "$tmp_summary" "$tmp_filter_all" "$tmp_filter_free"' EXIT

awk '!/^#/ && NF {print}' "$BASELINE_ALL" > "$tmp_all"
awk '!/^#/ && NF {print}' "$BASELINE_FREE" > "$tmp_free"

if [[ -n "$TARGET_GAME" ]]; then
  tmp_filter_all="$(mktemp)"
  tmp_filter_free="$(mktemp)"
  awk -v target="$TARGET_GAME" '$1 == target' "$tmp_all" > "$tmp_filter_all"
  awk -v target="$TARGET_GAME" '$1 == target' "$tmp_free" > "$tmp_filter_free"
  tmp_all="$tmp_filter_all"
  tmp_free="$tmp_filter_free"
fi

while IFS=$'\t' read -r game _expected_gotos _expected_unable _expected_classes _expected_exc; do
  marker_file="$GAMES_DIR/$game/deob-safe/logs/cfr-markers.txt"
  if [[ ! -f "$marker_file" ]]; then
    printf '%s\tMISSING\tMISSING\tMISSING\tMISSING\n' "$game" >> "$tmp_summary"
    continue
  fi
  gotos="$(grep -c '\*\* GOTO' "$marker_file" || true)"
  unable="$(grep -c 'Unable to fully structure code\|lbl-1000' "$marker_file" || true)"
  classes="$(cut -d: -f1 "$marker_file" | sort -u | wc -l)"
  exc_file="$GAMES_DIR/$game/deob-safe/logs/cfr-exceptions.txt"
  exc=0
  if [[ -f "$exc_file" ]]; then
    exc="$(grep -c 'Exception decompiling' "$exc_file" || true)"
  fi
  printf '%s\t%s\t%s\t%s\t%s\n' "$game" "$gotos" "$unable" "$classes" "$exc" >> "$tmp_summary"
done < "$tmp_all"

regressions=0
improvements=0

while IFS=$'\t' read -r game gotos unable classes exc; do
  [[ -z "${game:-}" ]] && continue
  if [[ "$gotos" == "MISSING" ]]; then
    printf "%-28s missing deob-safe/logs/cfr-markers.txt\n" "$game"
    regressions=$((regressions + 1))
    continue
  fi
  expected_line="$(awk -F'\t' -v game="$game" '$1 == game {print; found=1} END {if (!found) exit 1}' "$tmp_all" || true)"
  if [[ -z "$expected_line" ]]; then
    printf "%-28s gotos=%s unable=%s classes=%s exc=%s NEW-GAME\n" "$game" "$gotos" "$unable" "$classes" "$exc"
    regressions=$((regressions + 1))
    continue
  fi
  IFS=$'\t' read -r _ expected_gotos expected_unable expected_classes expected_exc <<< "$expected_line"
  # Baselines predating the exception column omit the 5th field; treat a missing
  # expectation as "no worse than current" so old rows never spuriously fail.
  [[ -z "${expected_exc:-}" ]] && expected_exc="$exc"
  if (( gotos > expected_gotos || unable > expected_unable || classes > expected_classes || exc > expected_exc )); then
    printf "%-28s expected<=%s/%s/%s/%s got=%s/%s/%s/%s REGRESSION\n" \
      "$game" "$expected_gotos" "$expected_unable" "$expected_classes" "$expected_exc" "$gotos" "$unable" "$classes" "$exc"
    regressions=$((regressions + 1))
  elif (( gotos < expected_gotos || unable < expected_unable || classes < expected_classes || exc < expected_exc )); then
    printf "%-28s expected<=%s/%s/%s/%s got=%s/%s/%s/%s improved\n" \
      "$game" "$expected_gotos" "$expected_unable" "$expected_classes" "$expected_exc" "$gotos" "$unable" "$classes" "$exc"
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
total_exc="$(awk -F'\t' '$5 != "MISSING" && $5 != "" {s += $5} END {print s + 0}' "$tmp_summary")"
goto_games="$(awk -F'\t' '$2 != "MISSING" && $2 > 0 {c++} END {print c + 0}' "$tmp_summary")"

if (( regressions > 0 )); then
  echo "FAIL: $regressions regression(s), $improvements improvement(s), $total_gotos GOTO markers across $goto_games games, $total_unable unable markers, $total_exc decompile exceptions"
  exit 1
fi

echo "PASS: no GOTO baseline regressions, $improvements improvement(s), $total_gotos GOTO markers across $goto_games games, $total_unable unable markers, $total_exc decompile exceptions"
