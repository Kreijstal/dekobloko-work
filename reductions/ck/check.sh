#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JT="${JT:-/home/kreijstal/git/java-tools-dekob-inline-return}"
CFR="${CFR:-$ROOT/lib/cfr.jar}"

cd "$ROOT"

for name in CkClipBad CkClipFixed2 CkClipFlagFixed CkClipFlagJavacShape; do
    node "$JT/scripts/jvm-cli.js" assemble "reductions/ck/$name.j" \
        --out "reductions/ck/$name.class" >/dev/null
    rm -rf "reductions/ck/cfr-$name"
    java -jar "$CFR" "reductions/ck/$name.class" \
        --outputdir "reductions/ck/cfr-$name" >/dev/null 2>&1 || true
    markers=$((grep -RhcE '\*\* GOTO|Unable to fully structure code|lbl-1000|Exception decompiling' \
        "reductions/ck/cfr-$name" 2>/dev/null || true) | awk '{s+=$1} END {print s+0}')
    printf "%-14s %s marker(s)\n" "$name" "$markers"
done
