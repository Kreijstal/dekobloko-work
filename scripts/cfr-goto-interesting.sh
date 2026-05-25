#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 CASE.j" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-${JT_DIR:-/home/kreijstal/git/java-tools}}"
CFR_JAR="$ROOT/lib/cfr.jar"
CASE="$1"
WORK="${TMPDIR:-/tmp}/cfr-goto-interesting-$$"
PATTERN="${CFR_GOTO_PATTERN:-\\*\\* GOTO|Unable to fully structure code|lbl-1000}"

cleanup() {
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$WORK/cfr"

node "$JAVA_TOOLS_DIR/scripts/jvm-cli.js" assemble "$CASE" --out "$WORK/Candidate.class" >/dev/null 2>&1
java -jar "$CFR_JAR" "$WORK/Candidate.class" --outputdir "$WORK/cfr" --silent true --caseinsensitivefs false >/dev/null 2>&1 || true

if find "$WORK/cfr" -name '*.java' -print0 | xargs -0 --no-run-if-empty grep -Eq "$PATTERN"; then
  exit 0
fi

exit 1
