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
WORK="${TMPDIR:-/tmp}/cfr-goto-valid-local-$$"
PATTERN="${CFR_GOTO_PATTERN:-\\*\\* GOTO|Unable to fully structure code|lbl-1000}"
BAD_PATTERN="${CFR_GOTO_BAD_PATTERN:-Exception decompiling|Invisible function parameters|uninitialised local|uninitialized local|reads of uninitialised local variables|reads of uninitialized local variables|VerifyError|ClassFormatError|if \\(true\\) \\*\\* GOTO|if \\([0-9]+ == [0-9]+\\) \\*\\* GOTO}"

cleanup() {
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$WORK/cfr"

CLASS_NAME="$(awk '/^\.class[[:space:]]/ { print $NF; exit }' "$CASE")"
if [ -z "$CLASS_NAME" ]; then
  exit 1
fi
CLASS_FILE="$WORK/${CLASS_NAME}.class"
mkdir -p "$(dirname "$CLASS_FILE")"

if [ "${CFR_GOTO_REQUIRE_LOCAL_SANITY:-0}" = "1" ]; then
  node "$ROOT/scripts/check-j-local-sanity.js" "$CASE" >/dev/null 2>&1 || exit 1
fi

node "$JAVA_TOOLS_DIR/scripts/jvm-cli.js" assemble "$CASE" --out "$CLASS_FILE" >/dev/null 2>&1
VERIFY_LOG="$WORK/verify.log"
java -Xverify:all -cp "$WORK" "${CLASS_NAME//\//.}" >"$VERIFY_LOG" 2>&1 || true
if grep -Eq 'ClassFormatError|Inconsistent stackmap|Illegal target of jump' "$VERIFY_LOG"; then
  exit 1
fi

java -jar "$CFR_JAR" "$CLASS_FILE" --outputdir "$WORK/cfr" --silent true --caseinsensitivefs false >/dev/null 2>&1 || true

if find "$WORK/cfr" -name '*.java' -print0 | xargs -0 --no-run-if-empty grep -Eq "$BAD_PATTERN"; then
  exit 1
fi

if find "$WORK/cfr" -name '*.java' -print0 | xargs -0 --no-run-if-empty grep -Eq "$PATTERN"; then
  exit 0
fi

exit 1
