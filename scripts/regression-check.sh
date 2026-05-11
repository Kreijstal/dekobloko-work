#!/usr/bin/env bash
# Focused regression harness for representative Dekobloko classes.
# It uses the same bulk pipeline as the all-class harness, then checks the
# representative expected marker ceilings fail-fast.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEKOB_DIR="$(dirname "$SCRIPT_DIR")"
JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-${JT_DIR:-/home/kreijstal/git/java-tools}}"
ASM_LIB="$JAVA_TOOLS_DIR/lib"
ASM_CP_BASE="$ASM_LIB/asm-9.9.1.jar:$ASM_LIB/asm-tree-9.9.1.jar:$ASM_LIB/asm-analysis-9.9.1.jar"
CFR_JAR="$DEKOB_DIR/lib/cfr.jar"
CLASSES_DIR="$DEKOB_DIR/classes-original"
VERIFY_CP="$ASM_CP_BASE:$SCRIPT_DIR"
PROFILE="dekobloko"
SKIP=""

if [[ ! -f "$SCRIPT_DIR/Verify.class" ]] || [[ "$SCRIPT_DIR/Verify.java" -nt "$SCRIPT_DIR/Verify.class" ]]; then
    javac -cp "$ASM_CP_BASE" -d "$SCRIPT_DIR" "$SCRIPT_DIR/Verify.java"
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        --profile) PROFILE="$2"; shift 2 ;;
        --skip)    SKIP="$SKIP $2"; shift 2 ;;
        *) echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

EXPECTED=(
    "client 0"
    "qc 0"
    "mn 0"
    "le 0"
    "pl 0"
    "ke 0"
    "me 0"
    "bl 0"
    "uk 0"
    "bb 0"
    "ad 0"
    "wf 0"
    "ug 0"
    "on 0"
    "mf 0"
    "im 0"
    "de 0"
    "ui 0"
    "td 0"
    "oe 0"
    "ne 0"
    "lk 0"
    "kf 0"
    "db 0"
    "cm 0"
)

WORK=$(mktemp -d -t dekobench-focused-XXXXXX)
trap "rm -rf $WORK" EXIT

echo "[*] profile: $PROFILE"
echo "[*] regression check on ${#EXPECTED[@]} representative classes"
echo "[*] Bulk pipeline..."
mkdir -p "$WORK/out"
pipeline_log="$WORK/pipeline.log"
if ! JAVA_TOOLS_DIR="$JAVA_TOOLS_DIR" node "$DEKOB_DIR/scripts/pipeline/bulk-pipeline.js" "$CLASSES_DIR" "$WORK/out" --profile "$PROFILE" >"$pipeline_log" 2>&1; then
    tail -20 "$pipeline_log"
    exit 1
fi
tail -1 "$pipeline_log"

echo "[*] CFR..."
mkdir -p "$WORK/cfr"
java -jar "$CFR_JAR" "$WORK/out"/*.class --outputdir "$WORK/cfr" >/dev/null 2>&1

echo "[*] Verify..."
verify_out=$(java -cp "$VERIFY_CP" Verify "$WORK/out"/*.class 2>&1)
verify_failed=$(echo "$verify_out" | awk -F'ClassesWithFails: ' '/ClassesWithFails:/ {print $2}')
verify_failed=${verify_failed:-0}
if [[ "$verify_failed" -gt 0 ]]; then
    echo "$verify_out" | grep "FAIL_CLASS:" | head -10
    echo "FAIL: $verify_failed verifier failure(s)"
    exit 1
fi

PASSED=0
echo
for entry in "${EXPECTED[@]}"; do
    cls="${entry% *}"
    expected="${entry##* }"

    if [[ " $SKIP " == *" $cls "* ]]; then
        printf "  %-12s (skipped)\n" "$cls"
        continue
    fi

    src="$WORK/cfr/$cls.java"
    if [[ ! -f "$src" ]]; then
        echo "FATAL: CFR output missing for $cls" >&2
        exit 1
    fi
    actual=$(grep -hcE '\*\* GOTO|Unable to fully structure code|lbl-1000' "$src" 2>/dev/null)
    actual=${actual:-0}
    if [[ "$actual" -gt "$expected" ]]; then
        printf "  %-12s expected ≤ %3d  got %3d  REGRESSION\n" "$cls" "$expected" "$actual"
        echo
        echo "FAIL: $cls regressed ($expected -> $actual). Stopping."
        exit 1
    fi
    printf "  %-12s expected ≤ %3d  got %3d  verify=ok\n" "$cls" "$expected" "$actual"
    PASSED=$((PASSED + 1))
done

echo
echo "PASS: $PASSED/${#EXPECTED[@]}"
