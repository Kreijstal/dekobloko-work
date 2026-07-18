#!/usr/bin/env bash
# Sync freshly-decompiled Java sources for every game into the
# funorb-decompiled repo. Only games with a complete source set that passed
# the pipeline, bytecode verification, and javac are synced. Decompiler
# fallbacks remain reported, but do not prevent compile-clean output syncing.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$SCRIPT_DIR")"
WORK="$REPO/.work/games"
DEST="${FUNORB_REPO:-/home/kreijstal/git/funorb-decompiled}"

[[ -d "$DEST/games" ]] || { echo "FATAL: no games dir in $DEST" >&2; exit 2; }

synced=0 skipped=""
for game_dir in "$WORK"/*/; do
  game="$(basename "$game_dir")"
  javadir="$game_dir/decompile-owned/java"
  report="$game_dir/decompile-owned/logs/report.json"
  if [[ ! -f "$report" ]] || ! node - "$report" <<'NODE'
const fs = require('fs');
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const failures = report.failures || {};
const complete = report.classes > 0 && report.sources === report.classes;
const compileClean = failures.pipeline === 0 && failures.verify === 0 && failures.javac === 0;
process.exit(complete && compileClean ? 0 : 1);
NODE
  then
    skipped="$skipped $game(not-compile-clean)"; continue
  fi
  if ! find "$javadir" -type f -name '*.java' -print -quit 2>/dev/null | rg -q .; then
    skipped="$skipped $game(no-java)"; continue
  fi
  mkdir -p "$DEST/games/$game"
  # delete stale .java in dest, then copy fresh (mirror the decompiler output)
  rsync -a --delete --include='*/' --include='*.java' --exclude='*' \
    "$javadir"/ "$DEST/games/$game"/
  signature_map="$game_dir/decompile-owned/logs/signature-map.json"
  if [[ -f "$signature_map" ]]; then
    cp "$signature_map" "$DEST/games/$game/signature-map.json"
  else
    rm -f "$DEST/games/$game/signature-map.json"
  fi
  synced=$((synced + 1))
done

echo "synced $synced games"
[[ -n "$skipped" ]] && echo "skipped:$skipped"
exit 0
