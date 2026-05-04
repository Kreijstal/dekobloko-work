#!/usr/bin/env bash
# Fail-fast regression harness for the JS deobfuscation pipeline.
# Iterates over (class, expected-marker-count) pairs and exits on the first
# class whose actual count is HIGHER than expected.
#
# Usage:
#   ./regression-check.sh                  # run default pipeline
#   ./regression-check.sh --pipeline "peephole strip-rethrow normalizer"
#   ./regression-check.sh --skip ke        # skip known-bad class
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEKOB_DIR="$(dirname "$SCRIPT_DIR")"
JT_DIR=/home/kreijstal/git/java-tools
ASM_LIB="$JT_DIR/lib"
ASM_CP_BASE="$ASM_LIB/asm-9.9.1.jar:$ASM_LIB/asm-tree-9.9.1.jar:$ASM_LIB/asm-analysis-9.9.1.jar"
CFR_JAR="$DEKOB_DIR/lib/cfr.jar"
CLASSES_DIR="$DEKOB_DIR/classes-original"
VERIFY_CP="$ASM_CP_BASE:$SCRIPT_DIR"

if [[ ! -f "$SCRIPT_DIR/Verify.class" ]] || [[ "$SCRIPT_DIR/Verify.java" -nt "$SCRIPT_DIR/Verify.class" ]]; then
    javac -cp "$ASM_CP_BASE" -d "$SCRIPT_DIR" "$SCRIPT_DIR/Verify.java"
fi

PIPELINE="peephole strip-rethrow normalizer"
SKIP=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --pipeline) PIPELINE="$2"; shift 2 ;;
        --skip)     SKIP="$SKIP $2"; shift 2 ;;
        *) echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

# Per-class CFR-marker upper bound after the JS pipeline. Verifier-correct
# baseline: every class verifies (no stack imbalance) and CFR markers are
# at most this count. Improvements welcome, regressions fail the harness.
EXPECTED=(
    "client 13"
    "qc 18"
    "mn 3"
    "le 9"
    "pl 8"
    "ke 10"
    "me 3"
    "bl 3"
    "uk 7"
    "bb 6"
    "ad 10"
    "wf 3"
    "ug 2"
    "on 2"
    "mf 3"
    "im 0"
    "de 3"
    "ui 3"
    "td 5"
    "oe 2"
    "ne 3"
    "lk 4"
    "kf 0"
    "db 2"
    "cm 3"
)

apply_pass() {
    local pass="$1" file="$2"
    case "$pass" in
        peephole)         node "$JT_DIR/scripts/jvm-cli.js" peephole-clean "$file" --out "$file" >/dev/null 2>&1 ;;
        strip-rethrow)    node "$JT_DIR/scripts/jvm-cli.js" strip-rethrow-handlers "$file" --keep-handler-code --out "$file" >/dev/null 2>&1 ;;
        condition-invert) node "$JT_DIR/scripts/jvm-cli.js" condition-invert "$file" --out "$file" >/dev/null 2>&1 ;;
        normalizer)       node "$JT_DIR/scripts/jvm-cli.js" multi-entry-normalize "$file" --out "$file" >/dev/null 2>&1 ;;
        *) echo "Unknown pass: $pass" >&2; return 1 ;;
    esac
}

count_markers() {
    local cls="$1"
    local out=$(mktemp -d)
    java -jar "$CFR_JAR" "$cls" --outputdir "$out" >/dev/null 2>&1
    local n=$(grep -hE '\*\* GOTO|Unable to fully structure code|lbl-1000' -r "$out" --include='*.java' 2>/dev/null | wc -l)
    rm -rf "$out"
    echo "$n"
}

# Run ASM BasicVerifier; print failure count to stdout (0 = clean).
verify_class() {
    local cls="$1"
    java -cp "$VERIFY_CP" Verify "$cls" 2>&1 | awk -F'Failed: ' '/Failed:/ {print $2}'
}

echo "[*] pipeline: $PIPELINE"
echo "[*] regression check on ${#EXPECTED[@]} classes"
echo

PASSED=0
for entry in "${EXPECTED[@]}"; do
    cls="${entry% *}"
    expected="${entry##* }"

    # Skip user-flagged classes
    if [[ " $SKIP " == *" $cls "* ]]; then
        printf "  %-12s (skipped)\n" "$cls"
        continue
    fi

    src="$CLASSES_DIR/$cls.class"
    if [[ ! -f "$src" ]]; then
        echo "FATAL: $src missing" >&2
        exit 1
    fi

    work=$(mktemp -d)
    cp "$src" "$work/c.class"
    for p in $PIPELINE; do
        apply_pass "$p" "$work/c.class" || true
    done
    actual=$(count_markers "$work/c.class")
    fails=$(verify_class "$work/c.class")
    rm -rf "$work"

    if [[ "$fails" != "0" && -n "$fails" ]]; then
        printf "  %-12s VERIFY FAIL — %s methods rejected by ASM verifier\n" "$cls" "$fails"
        echo
        echo "FAIL: $cls produced unverifiable bytecode. Stopping."
        exit 1
    fi
    if [[ "$actual" -gt "$expected" ]]; then
        printf "  %-12s expected ≤ %3d  got %3d  REGRESSION\n" "$cls" "$expected" "$actual"
        echo
        echo "FAIL: $cls regressed ($expected → $actual). Stopping."
        exit 1
    fi
    sign=""
    if [[ "$actual" -lt "$expected" ]]; then sign="  (improved by $((expected - actual)))"; fi
    printf "  %-12s expected ≤ %3d  got %3d  verify=ok%s\n" "$cls" "$expected" "$actual" "$sign"
    PASSED=$((PASSED + 1))
done

echo
echo "PASS: $PASSED/${#EXPECTED[@]}"
