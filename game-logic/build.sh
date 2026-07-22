#!/usr/bin/env bash
set -euo pipefail

module_root=$(cd "$(dirname "$0")" && pwd)
repo_root=$(cd "$module_root/.." && pwd)
build_dir="$module_root/build"
main_classes="$build_dir/classes/main"
test_classes="$build_dir/classes/test"
original_stub_classes="$build_dir/classes/original-stubs"

case "$build_dir" in
  "$module_root"/build) ;;
  *) echo "refusing to clean unexpected build directory: $build_dir" >&2; exit 1 ;;
esac

rm -rf -- "$build_dir"
mkdir -p "$main_classes" "$test_classes" "$original_stub_classes"

find "$module_root/src/main/java" -name '*.java' -print0 \
  | sort -z \
  | xargs -0 javac -source 8 -target 8 -Xlint:all,-options -d "$main_classes"

find "$module_root/src/test/java" -name '*.java' -print0 \
  | sort -z \
  | xargs -0 javac -source 8 -target 8 -Xlint:all,-options \
      -cp "$main_classes" -d "$test_classes"

jar cf "$build_dir/dekobloko-game-logic.jar" -C "$main_classes" .
java -cp "$main_classes:$test_classes" org.alterorb.dekobloko.logic.GameLogicTest

if [ -d "$repo_root/classes-original" ]; then
  find "$module_root/src/original-stubs/java" -name '*.java' -print0 \
    | sort -z \
    | xargs -0 javac -source 8 -target 8 -Xlint:all,-options \
        -cp "$repo_root/classes-original" -d "$original_stub_classes"

  java -cp "$main_classes:$test_classes:$repo_root/classes-original" \
    org.alterorb.dekobloko.logic.OriginalSpeedDifferentialTest
  java -Djava.awt.headless=true \
    -Ddekobloko.original.classes="$repo_root/classes-original" \
    -Ddekobloko.original.stubs="$original_stub_classes" \
    -cp "$main_classes:$test_classes" \
    org.alterorb.dekobloko.logic.OriginalStateDifferentialTest
  java -Djava.awt.headless=true \
    -Ddekobloko.original.classes="$repo_root/classes-original" \
    -Ddekobloko.original.stubs="$original_stub_classes" \
    -cp "$main_classes:$test_classes" \
    org.alterorb.dekobloko.logic.OriginalMultiplayerProtocolTest
fi

echo "Built $build_dir/dekobloko-game-logic.jar"
