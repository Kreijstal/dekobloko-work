#!/usr/bin/env bash
# Build a playable gamepack jar that mixes recompiled (decompiled) classes with
# original ones, so a runtime bug can be bisected to a class by actually playing.
#
# Usage:
#   scripts/build-hybrid-gamepack.sh <out.jar> [class ...]
#
# Every class is taken from the recompiled build except the ones named on the
# command line (with or without a .class suffix), which are taken from the
# original gamepack. With no class names the result is a pure recompiled jar;
# with every class named it is byte-identical in behavior to the original.
#
# Examples:
#   # pure recompiled build (should reproduce the bug)
#   scripts/build-hybrid-gamepack.sh .work/games/dekobloko/hybrid-all-recompiled.jar
#
#   # recompiled, but the six state-machine-fallback classes kept original
#   scripts/build-hybrid-gamepack.sh .work/games/dekobloko/hybrid-no-fallback.jar a db rg uk wd
#
# Then play it:
#   scripts/launcher/run-real-awt.sh --gamepack <out.jar>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

RECOMPILED_DIR="${RECOMPILED_DIR:-$ROOT/.work/games/dekobloko/decompile-owned/classes}"
ORIGINAL_DIR="${ORIGINAL_DIR:-$ROOT/classes-original}"
ABI_DIR="${ABI_DIR:-$RECOMPILED_DIR-abi}"

# The recompiled classes carry the decompiler's `field_` prefix, so they do not
# link against original classes. Mixing the two requires the restored ABI.
if [[ ! -d $ABI_DIR ]]; then
    "$SCRIPT_DIR/restore-abi.sh" "$RECOMPILED_DIR" "$ABI_DIR" \
        --verify-against "$ORIGINAL_DIR" >&2
fi
RECOMPILED_DIR="$ABI_DIR"

if [[ $# -lt 1 ]]; then
    sed -n '2,22p' "$0" >&2
    exit 2
fi

OUT="$1"
shift

for d in "$RECOMPILED_DIR" "$ORIGINAL_DIR"; do
    [[ -d $d ]] || { echo "missing class directory: $d" >&2; exit 1; }
done

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp "$RECOMPILED_DIR"/*.class "$STAGE/"

kept=0
for cls in "$@"; do
    name="${cls%.class}"
    src="$ORIGINAL_DIR/$name.class"
    [[ -f $src ]] || { echo "no such original class: $name" >&2; exit 1; }
    cp "$src" "$STAGE/$name.class"
    kept=$((kept + 1))
done

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
# zip runs from the staging dir, so the output path has to be absolute.
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
# -X keeps the archive free of extra attributes; the launcher only reads entries.
(cd "$STAGE" && zip -q -X -r "$OUT" . -i '*.class')

total=$(ls -1 "$STAGE"/*.class | wc -l)
echo "wrote $OUT: $total classes, $kept kept from original, $((total - kept)) recompiled"
