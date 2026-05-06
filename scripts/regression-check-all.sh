#!/usr/bin/env bash
# Bulk regression harness: applies the deobfuscation pipeline to ALL .class
# files in classes-original/, runs CFR on every output, and compares each
# class against an EXPECTED ceiling. Bulk-mode for speed (single Node
# process, single CFR JVM).
#
# Usage:
#   ./regression-check-all.sh                 # PASS if every class ≤ expected
#   ./regression-check-all.sh --update        # write current state to EXPECTED-ALL
#   ./regression-check-all.sh --report        # per-class table only, ignore EXPECTED
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEKOB_DIR="$(dirname "$SCRIPT_DIR")"
JT_DIR=/home/kreijstal/git/java-tools
ASM_LIB="$JT_DIR/lib"
ASM_CP_BASE="$ASM_LIB/asm-9.9.1.jar:$ASM_LIB/asm-tree-9.9.1.jar:$ASM_LIB/asm-analysis-9.9.1.jar"
CFR_JAR="$DEKOB_DIR/lib/cfr.jar"
CLASSES_DIR="$DEKOB_DIR/classes-original"
EXPECTED_FILE="$SCRIPT_DIR/EXPECTED-ALL.txt"
VERIFY_CP="$ASM_CP_BASE:$SCRIPT_DIR"

if [[ ! -f "$SCRIPT_DIR/Verify.class" ]] || [[ "$SCRIPT_DIR/Verify.java" -nt "$SCRIPT_DIR/Verify.class" ]]; then
    javac -cp "$ASM_CP_BASE" -d "$SCRIPT_DIR" "$SCRIPT_DIR/Verify.java"
fi

MODE="check"
case "${1:-}" in
  --update) MODE="update" ;;
  --report) MODE="report" ;;
esac

WORK=$(mktemp -d -t dekobench-XXXXXX)
trap "rm -rf $WORK" EXIT

# Stage 1: bulk pipeline (single Node process for speed)
echo "[*] Bulk pipeline (343 classes)..."
mkdir -p "$WORK/out"
node "$JT_DIR/scripts/bulk-pipeline.js" "$CLASSES_DIR" "$WORK/out" 2>&1 | tail -1

# Stage 2: CFR all classes (single JVM)
echo "[*] CFR..."
mkdir -p "$WORK/cfr"
java -jar "$CFR_JAR" "$WORK/out"/*.class --outputdir "$WORK/cfr" >/dev/null 2>&1

# Stage 3: collect per-class markers
declare -A actual
for f in "$WORK/cfr"/*.java; do
    base=$(basename "$f" .java)
    n=$(grep -hcE '\*\* GOTO|Unable to fully structure code|lbl-1000' "$f" 2>/dev/null); n=${n:-0}
    actual[$base]=$n
done

# Stage 4: verify all classes (BasicVerifier, single JVM batch)
echo "[*] Verify..."
total_classes=$(ls "$WORK/out"/*.class | wc -l)
verify_out=$(java -cp "$VERIFY_CP" Verify "$WORK/out"/*.class 2>&1)
verify_failed=$(echo "$verify_out" | awk -F'ClassesWithFails: ' '/ClassesWithFails:/ {print $2}')
verify_failed=${verify_failed:-0}
if [[ "$verify_failed" -gt 0 ]]; then
    echo "$verify_out" | grep "FAIL_CLASS:" | head -10
fi
echo "[*] Verified: $((total_classes - verify_failed))/$total_classes clean"

# Stage 5: report / check / update
case "$MODE" in
  update)
    {
        for base in "${!actual[@]}"; do
            echo "$base ${actual[$base]}"
        done
    } | sort > "$EXPECTED_FILE"
    echo "Updated $EXPECTED_FILE with current state"
    cat "$EXPECTED_FILE" | awk '{s+=$2; if($2>0) c++} END {print "  total:", s, "markers across", c, "classes"}'
    ;;
  report)
    echo
    echo "=== Per-class markers (>0) ==="
    for base in "${!actual[@]}"; do
        n=${actual[$base]}
        [[ "$n" -gt 0 ]] && echo "$base $n"
    done | sort -k2 -rn
    total=0; classes=0
    for n in "${actual[@]}"; do
        total=$((total + n))
        [[ "$n" -gt 0 ]] && classes=$((classes + 1))
    done
    echo
    echo "Total: $total markers across $classes/$total_classes classes (verifier failed: $verify_failed)"
    ;;
  check)
    if [[ ! -f "$EXPECTED_FILE" ]]; then
        echo "FATAL: $EXPECTED_FILE not found. Run with --update to create it." >&2
        exit 1
    fi
    declare -A expected
    while read -r base n; do
        [[ -z "$base" ]] && continue
        expected[$base]=$n
    done < "$EXPECTED_FILE"
    regress=0
    improved=0
    matched=0
    for base in "${!actual[@]}"; do
        a=${actual[$base]}
        e=${expected[$base]:-0}
        if [[ "$a" -gt "$e" ]]; then
            printf "  %-12s expected ≤ %3d  got %3d  REGRESSION\n" "$base" "$e" "$a"
            regress=$((regress + 1))
        elif [[ "$a" -lt "$e" ]]; then
            printf "  %-12s expected ≤ %3d  got %3d  improved by %d\n" "$base" "$e" "$a" $((e - a))
            improved=$((improved + 1))
        else
            matched=$((matched + 1))
        fi
    done
    echo
    if [[ "$regress" -gt 0 || "$verify_failed" -gt 0 ]]; then
        echo "FAIL: $regress class(es) regressed, $verify_failed verifier failure(s)"
        exit 1
    fi
    total=0; classes=0
    for n in "${actual[@]}"; do
        total=$((total + n))
        [[ "$n" -gt 0 ]] && classes=$((classes + 1))
    done
    echo "PASS: $matched matched, $improved improved, total $total markers across $classes classes"
    ;;
esac
