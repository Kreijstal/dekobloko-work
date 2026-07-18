#!/usr/bin/env bash
# Sync freshly-decompiled Java sources for every game into the
# funorb-decompiled repo. Only games with a complete source set that passed
# the pipeline, bytecode verification, and javac are synced. Decompiler
# fallbacks remain reported, but do not prevent compile-clean output syncing.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$SCRIPT_DIR")"
WORK="${OWNED_DECOMPILER_WORK:-$REPO/.work/games}"
DEST="${FUNORB_REPO:-/home/kreijstal/git/funorb-decompiled}"
PROVENANCE="$WORK/decompilation-provenance.json"

[[ -d "$DEST/games" ]] || { echo "FATAL: no games dir in $DEST" >&2; exit 2; }
[[ -f "$PROVENANCE" ]] || { echo "FATAL: missing generated provenance: $PROVENANCE" >&2; exit 2; }
node - "$PROVENANCE" <<'NODE'
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const name of ['dekoblokoWork', 'javaTools']) {
  const generator = manifest.generators && manifest.generators[name];
  if (!generator || !/^[0-9a-f]{40}$/.test(generator.commit || '')) {
    throw new Error(`invalid ${name} generator commit in provenance`);
  }
  if (generator.trackedClean !== true) {
    throw new Error(`refusing to publish output generated from dirty tracked ${name} files`);
  }
}
NODE
dest_base="$(git -C "$DEST" rev-parse HEAD 2>/dev/null)" \
  || { echo "FATAL: $DEST is not a Git worktree" >&2; exit 2; }
git -C "$DEST" diff --quiet HEAD -- \
  || { echo "FATAL: $DEST has tracked changes before synchronization" >&2; exit 2; }

synced=0 skipped=""
synced_games=()
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
  synced_games+=("$game")
done

node - "$PROVENANCE" "$DEST/decompilation-provenance.json.tmp" "$dest_base" "${synced_games[@]}" <<'NODE'
const fs = require('fs');
const [source, target, destinationBaseCommit, ...syncedGames] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
manifest.publication = {
  synchronizedAt: new Date().toISOString(),
  destinationBaseCommit,
  syncedGames,
};
fs.writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n');
NODE
mv "$DEST/decompilation-provenance.json.tmp" "$DEST/decompilation-provenance.json"
echo "synced $synced games"
[[ -n "$skipped" ]] && echo "skipped:$skipped"
exit 0
