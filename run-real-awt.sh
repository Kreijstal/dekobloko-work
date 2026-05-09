#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  echo "No DISPLAY or WAYLAND_DISPLAY is set; real AWT needs a desktop session." >&2
  exit 2
fi

./build-launcher.sh >/dev/null
exec java -Djava.awt.headless=false -jar dekobloko-launcher.jar \
  --awt real \
  --gamepack dekobloko.jar \
  --trace-file traces/real-awt.log \
  "$@"
