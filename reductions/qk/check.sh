#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JT="${JT:-/home/kreijstal/git/java-tools-dekob-inline-return}"
WORK="$(mktemp -d -t qk-reduction-XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/classes" "$WORK/cfr-bad" "$WORK/cfr-fixed"

awk '
/\.catch any from L5 to L240 using L243/ {
  print "    .catch any from L5 to L177 using L243";
  print "    .catch any from L235 to L240 using L243";
  next;
}
/\.catch any from L5 to L252 using L255/ {
  print "    .catch any from L5 to L177 using L255";
  print "    .catch any from L235 to L243 using L255";
  next;
}
{ print }
' "$ROOT/reductions/qk/qk.current.j" > "$WORK/qk.fixed.j"

node "$JT/scripts/jvm-cli.js" assemble "$ROOT/reductions/qk/qk.current.j" --out "$WORK/classes/qk.bad.class" >/dev/null
node "$JT/scripts/jvm-cli.js" assemble "$WORK/qk.fixed.j" --out "$WORK/classes/qk.fixed.class" >/dev/null

java -jar "$ROOT/lib/cfr.jar" "$WORK/classes/qk.bad.class" --outputdir "$WORK/cfr-bad" >/dev/null 2>&1
java -jar "$ROOT/lib/cfr.jar" "$WORK/classes/qk.fixed.class" --outputdir "$WORK/cfr-fixed" >/dev/null 2>&1

for name in bad fixed; do
  count=$((grep -RhcE '\*\* GOTO|Unable to fully structure code|lbl-1000' "$WORK/cfr-$name" 2>/dev/null || true) | awk '{s+=$1} END{print s+0}')
  printf "qk %-5s %s marker(s)\n" "$name" "$count"
done
