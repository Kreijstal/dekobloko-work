#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  echo "No DISPLAY or WAYLAND_DISPLAY is set; recording needs a desktop session." >&2
  exit 2
fi

record_file="${1:-traces/interaction.awtlog}"
shift || true

./build-launcher.sh >/dev/null
exec java -Djava.awt.headless=false -jar dekobloko-launcher.jar \
  --awt real \
  --gamepack dekobloko.jar \
  --trace-file traces/record-awt.log \
  --record-awt "$record_file" \
  "$@"
