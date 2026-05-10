#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

SRC_DIR="stubs/src"
CLASSES_DIR=".work/stubs/classes"

rm -rf "$CLASSES_DIR"
mkdir -p "$CLASSES_DIR" lib

if javac --help 2>&1 | grep -q -- '--release'; then
  javac --release 8 -d "$CLASSES_DIR" $(find "$SRC_DIR" -name '*.java' | sort)
else
  javac -source 8 -target 8 -d "$CLASSES_DIR" $(find "$SRC_DIR" -name '*.java' | sort)
fi

jar cf lib/dekobloko-stubs.jar -C "$CLASSES_DIR" .
echo "Built lib/dekobloko-stubs.jar"
