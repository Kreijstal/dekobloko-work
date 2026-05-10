#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
"$ROOT/scripts/launcher/build.sh" >/dev/null
exec java -jar "$ROOT/.work/launcher/dekobloko-launcher.jar" "$@"
