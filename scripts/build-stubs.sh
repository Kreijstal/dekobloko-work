#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

rm -rf stubs-classes
mkdir -p stubs-classes lib

if javac --help 2>&1 | grep -q -- '--release'; then
  javac --release 8 -d stubs-classes $(find stubs-src -name '*.java' | sort)
else
  javac -source 8 -target 8 -d stubs-classes $(find stubs-src -name '*.java' | sort)
fi

jar cf lib/dekobloko-stubs.jar -C stubs-classes .
echo "Built lib/dekobloko-stubs.jar"
