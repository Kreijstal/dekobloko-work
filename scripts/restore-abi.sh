#!/usr/bin/env bash
# Restore the original field ABI of decompiled+recompiled classes so a single
# recompiled class links against the otherwise-original jar (issue #11), which
# is the prerequisite for per-class differential bisection.
#
#   scripts/restore-abi.sh <recompiledClassesDir> <outDir> [--verify-against <origDir>]
#
# Uses ASM (asm-tree) to strip the CFR-JS `field_` prefix from field
# declarations and references. Field-name-only edits leave frames/maxs intact,
# so no StackMapTable recomputation is needed.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$SCRIPT_DIR")"
ASM_DIR="$REPO/.work/games/.owned-decompiler-tools/asm"
ASM_CP="$ASM_DIR/asm-9.9.1.jar:$ASM_DIR/asm-tree-9.9.1.jar:$ASM_DIR/asm-analysis-9.9.1.jar"
TOOLS_OUT="$REPO/.work/abi-tools"

if [[ ! -f "$ASM_DIR/asm-9.9.1.jar" ]]; then
  echo "FATAL: ASM jars not found under $ASM_DIR (run scripts/decompile-all-games.sh once to fetch them)" >&2
  exit 2
fi

mkdir -p "$TOOLS_OUT"
javac -cp "$ASM_CP" -d "$TOOLS_OUT" "$SCRIPT_DIR/AbiTools.java" "$SCRIPT_DIR/Verify.java"

java -cp "$TOOLS_OUT:$ASM_CP" AbiTools restore "$@"
