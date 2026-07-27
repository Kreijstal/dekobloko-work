#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JAVA_TOOLS_DIR="${JAVA_TOOLS_DIR:-$ROOT_DIR/../java-tools}"
INPUT_DIR="$ROOT_DIR/.work/games/dekobloko/decompile-owned/out"
WORK_DIR="$ROOT_DIR/.work/rename-map-validation"
CPU_PROFILE=0

usage() {
  cat <<'EOF'
Usage: scripts/validate-dekobloko-rename-map.sh [options]

Options:
  --input <dir>       Transformed DekoBloko class directory
  --work-dir <dir>    Validation output directory
  --cpu-profile       Write a V8 .cpuprofile for the mapping phase
  --help              Show this help
EOF
}

while (($#)); do
  case "$1" in
    --input)
      INPUT_DIR="$2"
      shift 2
      ;;
    --work-dir)
      WORK_DIR="$2"
      shift 2
      ;;
    --cpu-profile)
      CPU_PROFILE=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

MAP_FILE="$ROOT_DIR/mappings/dekobloko.json"
STUBS_JAR="$ROOT_DIR/lib/dekobloko-stubs.jar"
NAMED_DIR="$WORK_DIR/named-classes"
SOURCE_DIR="$WORK_DIR/sources"
CLASS_DIR="$WORK_DIR/recompiled-classes"
SOURCE_LIST="$WORK_DIR/sources.list"
FIELD_NAME_LIST="$WORK_DIR/semantic-field-names.txt"
PROFILE_DIR="$WORK_DIR/cpu-profile"

for required in "$INPUT_DIR" "$MAP_FILE" "$STUBS_JAR"; do
  if [[ ! -e "$required" ]]; then
    echo "Required input does not exist: $required" >&2
    exit 1
  fi
done

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"

map_command=(
  node
  "$JAVA_TOOLS_DIR/scripts/apply-rename-map.js"
  --force
  --profile
  "$INPUT_DIR"
  "$MAP_FILE"
  "$NAMED_DIR"
)
if ((CPU_PROFILE)); then
  mkdir -p "$PROFILE_DIR"
  map_command=(
    node
    --cpu-prof
    "--cpu-prof-dir=$PROFILE_DIR"
    "${map_command[@]:1}"
  )
fi

echo "Applying semantic rename map..."
"${map_command[@]}"

node -e '
  const fs = require("fs");
  const mapping = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(`${[...new Set(Object.values(mapping.fields || {}))].sort().join("\n")}\n`);
' "$MAP_FILE" > "$FIELD_NAME_LIST"

echo "Decompiling named classes..."
node "$JAVA_TOOLS_DIR/scripts/runCfr.js" \
  --silent \
  --preserve-field-names "$FIELD_NAME_LIST" \
  --classpath "$NAMED_DIR:$STUBS_JAR" \
  --outputdir "$SOURCE_DIR" \
  "$NAMED_DIR"

find "$SOURCE_DIR" -type f -name '*.java' -print | LC_ALL=C sort > "$SOURCE_LIST"
if [[ ! -s "$SOURCE_LIST" ]]; then
  echo "Decompiler emitted no Java sources" >&2
  exit 1
fi

echo "Compiling named sources..."
mkdir -p "$CLASS_DIR"
javac --release 8 \
  -proc:none \
  -cp "$STUBS_JAR" \
  -d "$CLASS_DIR" \
  "@$SOURCE_LIST"

input_count="$(find "$INPUT_DIR" -type f -name '*.class' | wc -l)"
named_count="$(find "$NAMED_DIR" -type f -name '*.class' | wc -l)"
source_count="$(wc -l < "$SOURCE_LIST")"
compiled_count="$(find "$CLASS_DIR" -type f -name '*.class' | wc -l)"

printf 'Validation passed: input=%s named=%s sources=%s recompiled=%s\n' \
  "$input_count" "$named_count" "$source_count" "$compiled_count"
if ((CPU_PROFILE)); then
  printf 'CPU profile: %s\n' "$PROFILE_DIR"
fi
