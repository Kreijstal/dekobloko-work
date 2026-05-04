#!/usr/bin/env bash
# Per-class deobfuscation pipeline test harness.
# Runs a chosen pipeline on one class, runs CFR before/after, reports marker delta.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEKOB_DIR="$(dirname "$SCRIPT_DIR")"
JT_DIR=/home/kreijstal/git/java-tools
CFR_JAR="$DEKOB_DIR/lib/cfr.jar"
CLASSES_DIR="$DEKOB_DIR/classes-original"

count_markers() {
    local cls="$1"
    local out=$(mktemp -d)
    java -jar "$CFR_JAR" "$cls" --outputdir "$out" >/dev/null 2>&1
    local n=$(grep -hcE '\*\* GOTO|Unable to fully structure code|lbl-1000' -r "$out" --include='*.java' 2>/dev/null || echo 0)
    rm -rf "$out"
    # If grep returns multiple files, the count is per-file; we want sum
    echo "$n" | awk '{s+=$1} END {print s+0}'
}

count_markers_total() {
    local cls="$1"
    local out=$(mktemp -d)
    java -jar "$CFR_JAR" "$cls" --outputdir "$out" >/dev/null 2>&1
    local n=$(grep -hE '\*\* GOTO|Unable to fully structure code|lbl-1000' -r "$out" --include='*.java' 2>/dev/null | wc -l)
    rm -rf "$out"
    echo "$n"
}

apply_pass() {
    local pass="$1" file="$2"
    case "$pass" in
        peephole)
            node "$JT_DIR/scripts/jvm-cli.js" peephole-clean "$file" --out "$file" >/dev/null 2>&1 ;;
        strip-rethrow)
            node "$JT_DIR/scripts/jvm-cli.js" strip-rethrow-handlers "$file" --keep-handler-code --out "$file" >/dev/null 2>&1 ;;
        condition-invert)
            node "$JT_DIR/scripts/jvm-cli.js" condition-invert "$file" --out "$file" >/dev/null 2>&1 ;;
        normalizer)
            node "$JT_DIR/scripts/jvm-cli.js" multi-entry-normalize "$file" --out "$file" >/dev/null 2>&1 ;;
        *)
            echo "Unknown pass: $pass" >&2; return 1 ;;
    esac
}

# Usage: ./per-class-test.sh <class-name> <pass1> [pass2 ...]
# Example: ./per-class-test.sh qc peephole strip-rethrow normalizer
CLS="$1"
shift
PASSES=("$@")

SRC="$CLASSES_DIR/$CLS.class"
if [[ ! -f "$SRC" ]]; then
    echo "Class not found: $SRC" >&2
    exit 1
fi

WORK=$(mktemp -d)
trap "rm -rf $WORK" EXIT
cp "$SRC" "$WORK/c.class"
BEFORE=$(count_markers_total "$WORK/c.class")

for p in "${PASSES[@]}"; do
    apply_pass "$p" "$WORK/c.class" || true
done

AFTER=$(count_markers_total "$WORK/c.class")
DELTA=$((AFTER - BEFORE))
SIGN="$DELTA"
[[ $DELTA -gt 0 ]] && SIGN="+$DELTA"
PIPE_STR="${PASSES[*]}"
printf "%-12s %3d → %3d  (%4s)  pipeline: %s\n" "$CLS" "$BEFORE" "$AFTER" "$SIGN" "$PIPE_STR"
