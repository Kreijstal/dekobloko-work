#!/usr/bin/env bash
# deobfuscate.sh — Generic bytecode deobfuscation pipeline
#
# Usage: ./deobfuscate.sh <input.{jar,class}> <output.{jar,class}> [options]
#
# Pipeline:
#   1. Peephole cleanup (nop removal, rethrow handler cleanup, goto cleanup)
#   2. Multi-entry loop header normalization (generic, CFG-shape-based)
#   3. Fallthrough join normalization
#
# No hardcoded class/method/field names — all passes are shape-based.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAVA_TOOLS_DIR="$(dirname "$SCRIPT_DIR")"
ASM_BUILD_DIR="$JAVA_TOOLS_DIR/build/asm-tools"
LIB_DIR="$JAVA_TOOLS_DIR/lib"

ASM_CORE_JAR="$LIB_DIR/asm-9.9.1.jar"
if [[ ! -f "$ASM_CORE_JAR" ]]; then
    ASM_CORE_JAR="/usr/share/java/maven/lib/asm-9.9.1.jar"
fi
ASM_CP="$ASM_CORE_JAR:$LIB_DIR/asm-tree-9.9.1.jar:$LIB_DIR/asm-analysis-9.9.1.jar:$ASM_BUILD_DIR"

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <input.{jar,class}> <output.{jar,class}> [options]"
    echo "Options:"
    echo "  --max-clone-insns N     Max instructions in cloneable block (default: 64)"
    echo "  --min-incoming N        Min incoming edges to consider a join (default: 2)"
    echo "  --dry-run               Report changes without writing output"
    echo "  --skip-peephole         Skip JS peephole cleanup phase"
    echo "  --skip-strip-rethrow    Skip JS strip-rethrow-handlers phase (with --keep-handler-code)"
    echo "  --skip-normalizer       Skip Java normalizer phases"
    echo "  --condition-invert      Run JS condition-invert pass (opt-in; can regress)"
    echo "  --condition-invert-distance N  Max instruction distance for condition-invert (default: 300)"
    echo "  --verbose               Print per-method statistics"
    exit 1
fi

INPUT="$1"
OUTPUT="$2"
shift 2

MAX_CLONE_INSNS=64
MIN_INCOMING=2
DRY_RUN=0
SKIP_PEEPHOLE=0
SKIP_STRIP_RETHROW=0
SKIP_NORMALIZER=0
RUN_CONDITION_INVERT=0
CONDITION_INVERT_DISTANCE=300
VERBOSE=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --max-clone-insns)             MAX_CLONE_INSNS="$2"; shift 2 ;;
        --min-incoming)                MIN_INCOMING="$2"; shift 2 ;;
        --dry-run)                     DRY_RUN=1; shift ;;
        --skip-peephole)               SKIP_PEEPHOLE=1; shift ;;
        --skip-strip-rethrow)          SKIP_STRIP_RETHROW=1; shift ;;
        --skip-normalizer)             SKIP_NORMALIZER=1; shift ;;
        --condition-invert)            RUN_CONDITION_INVERT=1; shift ;;
        --condition-invert-distance)   CONDITION_INVERT_DISTANCE="$2"; shift 2 ;;
        --verbose)                     VERBOSE=1; shift ;;
        *)                             echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Build ASM tools if needed
# ---------------------------------------------------------------------------
if [[ $SKIP_NORMALIZER -eq 0 ]]; then
    if [[ ! -f "$ASM_BUILD_DIR/MultiEntryLoopNormalizer.class" ]] || \
       [[ "$JAVA_TOOLS_DIR/tools/asm/MultiEntryLoopNormalizer.java" -nt "$ASM_BUILD_DIR/MultiEntryLoopNormalizer.class" ]]; then
        echo "[*] Building MultiEntryLoopNormalizer..."
        mkdir -p "$ASM_BUILD_DIR" "$LIB_DIR"
        if [[ ! -f "$LIB_DIR/asm-tree-9.9.1.jar" ]]; then
            for f in asm-tree asm-analysis; do
                if [[ ! -f "$LIB_DIR/${f}-9.9.1.jar" ]]; then
                    echo "[*] Downloading ${f}..."
                    curl -sL "https://repo1.maven.org/maven2/org/ow2/asm/${f}/9.9.1/${f}-9.9.1.jar" -o "$LIB_DIR/${f}-9.9.1.jar"
                fi
            done
        fi
        javac -cp "$ASM_CP" -d "$ASM_BUILD_DIR" "$JAVA_TOOLS_DIR/tools/asm/MultiEntryLoopNormalizer.java"
    fi
fi

# ---------------------------------------------------------------------------
# Process a single class
# ---------------------------------------------------------------------------
process_class() {
    local input="$1"
    local tmp=$(mktemp)
    cp "$input" "$tmp"

    local pass1_changes=0
    local pass_strip_changes=0
    local pass_invert_changes=0
    local pass2_splits=0
    local pass3_splits=0

    # Pass 1: Peephole cleanup
    if [[ $SKIP_PEEPHOLE -eq 0 ]]; then
        local result
        result=$(node "$JAVA_TOOLS_DIR/scripts/jvm-cli.js" peephole-clean "$tmp" --out "$tmp" 2>&1) || true
        if echo "$result" | grep -q "Peephole changes:"; then
            pass1_changes=$(echo "$result" | grep "Peephole changes:" | grep -oP '\d+')
        fi
    fi

    # Pass 1b: Strip trivial rethrow handler traps (keep handler code per README guidance)
    if [[ $SKIP_STRIP_RETHROW -eq 0 ]]; then
        local strip_out
        strip_out=$(node "$JAVA_TOOLS_DIR/scripts/jvm-cli.js" strip-rethrow-handlers "$tmp" --keep-handler-code --out "$tmp" 2>&1) || true
        pass_strip_changes=$(echo "$strip_out" | grep -c 'Removed trivial rethrow handler' || true)
    fi

    # Pass 1c: Optional condition-invert (opt-in; user-flagged as sometimes regressing)
    if [[ $RUN_CONDITION_INVERT -eq 1 ]]; then
        local inv_out
        inv_out=$(node "$JAVA_TOOLS_DIR/scripts/jvm-cli.js" condition-invert "$tmp" --max-distance "$CONDITION_INVERT_DISTANCE" --out "$tmp" 2>&1) || true
        local n
        n=$(echo "$inv_out" | grep -oP 'fixed=\K\d+' | head -1 || true)
        [[ -n "$n" ]] && pass_invert_changes="$n"
    fi

    # Pass 2+3: Multi-entry loop header + fallthrough normalization
    if [[ $SKIP_NORMALIZER -eq 0 ]]; then
        local norm_opts="--min-incoming $MIN_INCOMING --max-clone-insns $MAX_CLONE_INSNS"
        [[ $VERBOSE -eq 1 ]] && norm_opts="$norm_opts --verbose"

        # Phase 2: Multi-entry header splitting
        local norm_out
        norm_out=$(java -cp "$ASM_CP" MultiEntryLoopNormalizer "$tmp" "$tmp" $norm_opts 2>&1) || true
        pass2_splits=$(echo "$norm_out" | grep "splits=" | grep -oP 'splits=\K\d+')

        # Phase 3: Fallthrough normalization
        norm_out=$(java -cp "$ASM_CP" MultiEntryLoopNormalizer "$tmp" "$tmp" $norm_opts --normalize-fallthrough 2>&1) || true
        pass3_splits=$(echo "$norm_out" | grep "fallthrough=" | grep -oP 'fallthrough=\K\d+')
    fi

    local total=$((pass1_changes + pass_strip_changes + pass_invert_changes + pass2_splits + pass3_splits))
    if [[ $total -gt 0 ]]; then
        echo "  $input: peephole=$pass1_changes strip=$pass_strip_changes invert=$pass_invert_changes splits=$pass2_splits fallthrough=$pass3_splits"
        if [[ $DRY_RUN -eq 0 ]]; then
            cp "$tmp" "$input"
        fi
    fi
    rm -f "$tmp"
}

# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------
echo "[*] Processing $INPUT..."

if [[ "$INPUT" == *.jar ]]; then
    WORK_DIR=$(mktemp -d)
    cleanup() { rm -rf "$WORK_DIR"; }
    trap cleanup EXIT

    cd "$WORK_DIR"
    jar xf "$INPUT" 2>/dev/null || unzip -q "$INPUT"

    CLASS_COUNT=$(find . -name "*.class" -type f | wc -l)
    echo "[*] Found $CLASS_COUNT class files"

    find . -name "*.class" -type f | while read -r cls; do
        process_class "$cls"
    done

    echo "[*] Repacking to $OUTPUT..."
    if [[ $DRY_RUN -eq 0 ]]; then
        jar cf "$OUTPUT" . 2>/dev/null || zip -qr "$OUTPUT" .
    fi
elif [[ "$INPUT" == *.class ]]; then
    WORK_DIR=$(mktemp -d)
    cleanup() { rm -rf "$WORK_DIR"; }
    trap cleanup EXIT
    cp "$INPUT" "$WORK_DIR/input.class"
    process_class "$WORK_DIR/input.class"
    if [[ $DRY_RUN -eq 0 ]]; then
        cp "$WORK_DIR/input.class" "$OUTPUT"
    fi
else
    echo "[!] Unknown input type: $INPUT"
    exit 1
fi

echo "[*] Done."
if [[ $DRY_RUN -eq 1 ]]; then
    echo "[*] (dry run — no files written)"
fi
