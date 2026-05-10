#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
SRC_DIR="$ROOT/apps/launcher/src"
OUT_DIR="$ROOT/.work/launcher"
CLASSES_DIR="$OUT_DIR/classes"
JAR="$OUT_DIR/dekobloko-launcher.jar"
BOOTSTRAP_JAR="$ROOT/dekobloko-launcher.jar"

rm -rf "$CLASSES_DIR"
mkdir -p "$CLASSES_DIR"

javac_exports=(
  --add-exports java.desktop/sun.awt=ALL-UNNAMED
  --add-exports java.desktop/java.awt.peer=ALL-UNNAMED
  --add-exports java.desktop/java.awt.dnd.peer=ALL-UNNAMED
)

if [[ -f "$JAR" || -f "$BOOTSTRAP_JAR" ]]; then
  # The fake AWT provider uses JDK-internal peer APIs that are only reliably
  # rebuildable on older JDKs. Preserve those already-built classes, then
  # recompile the launcher/control classes from source.
  existing_jar="$JAR"
  if [[ ! -f "$existing_jar" ]]; then
    existing_jar="$BOOTSTRAP_JAR"
  fi
  (cd "$CLASSES_DIR" && jar xf "$existing_jar")
  javac -cp "$CLASSES_DIR" -d "$CLASSES_DIR" \
    "$SRC_DIR/local/Trace.java" \
    "$SRC_DIR/local/AwtInteractionLog.java" \
    "$SRC_DIR/local/DekoblokoLauncher.java"
  javac "${javac_exports[@]}" -cp "$CLASSES_DIR" -d "$CLASSES_DIR" \
    "$SRC_DIR/local/awt/FakeToolkit.java"
else
  javac "${javac_exports[@]}" -d "$CLASSES_DIR" $(find "$SRC_DIR" -name '*.java' | sort)
fi
jar cfe "$JAR" local.DekoblokoLauncher -C "$CLASSES_DIR" .

echo "Built $JAR"
