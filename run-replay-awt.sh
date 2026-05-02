#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

record_file="${1:-traces/interaction.awtlog}"
shift || true

./build-launcher.sh >/dev/null
exec java -Djava.awt.headless=false -jar dekobloko-launcher.jar \
  --awt fake \
  --trace-file traces/replay-awt.log \
  --replay-awt "$record_file" \
  "$@"
