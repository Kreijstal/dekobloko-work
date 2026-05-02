#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
rm -rf launcher-classes
mkdir -p launcher-classes

if javac --help 2>&1 | grep -q -- '--release'; then
  javac --release 8 -d launcher-classes $(find launcher-src -name '*.java' | sort)
else
  javac -source 8 -target 8 -d launcher-classes $(find launcher-src -name '*.java' | sort)
fi
jar cfe dekobloko-launcher.jar local.DekoblokoLauncher -C launcher-classes .

echo "Built dekobloko-launcher.jar"
