#!/usr/bin/env bash
# Compile CFR output one class at a time, using transformed classes plus
# dekobloko-stubs.jar as the classpath. This measures source-level conflicts
# without hiding failures behind a batch javac abort.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEKOB_DIR="$(dirname "$SCRIPT_DIR")"
JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-${JT_DIR:-/home/kreijstal/git/java-tools}}"
CFR_JAR="${CFR_JAR:-$DEKOB_DIR/lib/cfr.jar}"
STUB_JAR="${STUB_JAR:-$DEKOB_DIR/lib/dekobloko-stubs.jar}"
CLASSES_DIR="${CLASSES_DIR:-$DEKOB_DIR/classes-original}"

if [[ ! -f "$CFR_JAR" ]]; then
    echo "FATAL: CFR jar not found: $CFR_JAR" >&2
    exit 1
fi
if [[ ! -f "$STUB_JAR" ]]; then
    echo "FATAL: stub jar not found: $STUB_JAR" >&2
    exit 1
fi

WORK="${WORK:-$(mktemp -d -t dekob-compile-check-XXXXXX)}"
LOG_DIR="$WORK/javac-logs"
mkdir -p "$WORK/out" "$WORK/cfr" "$LOG_DIR"

echo "[*] Work dir: $WORK"
echo "[*] JAVA_TOOLS_DIR: $JAVA_TOOLS_DIR"

echo "[*] Bulk pipeline..."
pipeline_log="$WORK/pipeline.log"
if ! JAVA_TOOLS_DIR="$JAVA_TOOLS_DIR" node "$DEKOB_DIR/scripts/pipeline/bulk-pipeline.js" "$CLASSES_DIR" "$WORK/out" >"$pipeline_log" 2>&1; then
    tail -20 "$pipeline_log"
    exit 1
fi
tail -1 "$pipeline_log"

echo "[*] CFR..."
java -jar "$CFR_JAR" "$WORK/out"/*.class --outputdir "$WORK/cfr" >/dev/null 2>&1

echo "[*] javac per class..."
CP="$WORK/out:$STUB_JAR"
ok=0
fail=0
for src in "$WORK/cfr"/*.java; do
    cls="$(basename "$src" .java)"
    out_dir="$WORK/javac/$cls"
    mkdir -p "$out_dir"
    if javac -source 7 -target 7 -Xbootclasspath/p:"$STUB_JAR" -proc:none -cp "$CP" -sourcepath '' -d "$out_dir" "$src" >"$LOG_DIR/$cls.log" 2>&1; then
        ok=$((ok + 1))
    else
        fail=$((fail + 1))
    fi
done

echo "total=$((ok + fail)) ok=$ok fail=$fail logs=$LOG_DIR"
echo
echo "=== First-error summary ==="
for log in "$LOG_DIR"/*.log; do
    if grep -q "error:" "$log"; then
        grep "error:" "$log" | head -1 | sed 's/^.*error: //'
    fi
done | sort | uniq -c | sort -nr | head -40
