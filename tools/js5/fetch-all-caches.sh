#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONFIG="${ALTERORB_CONFIG:-$ROOT/.work/upstream-alterorb-launcher/config.json}"
GAMEPACK_DIR="${ALTERORB_GAMEPACK_DIR:-$ROOT/.work/gamepacks}"
TRACE_DIR="${ALTERORB_TRACE_DIR:-$ROOT/.work/cache-warm-traces}"
SERVER="${ALTERORB_SERVER:-https://mgg-server.alterorb.net}"
STATIC_BASE="${ALTERORB_STATIC_BASE:-https://static.alterorb.net/launcher/v3/jars}"
SLEEP_MS="${ALTERORB_CACHE_WARM_SLEEP_MS:-45000}"
GAME_FILTER="${ALTERORB_GAME_FILTER:-}"

if [[ "${ALLOW_UNTRUSTED_GAMEPACK_EXECUTION:-}" != "1" ]]; then
  cat >&2 <<'EOF'
FATAL: this script launches remote gamepack bytecode to warm caches.
Use only with ALLOW_UNTRUSTED_GAMEPACK_EXECUTION=1 in an isolated sandbox.

For reproducible cache mirroring, use a JS5 protocol downloader instead.
EOF
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "FATAL: config not found: $CONFIG" >&2
  exit 1
fi

cd "$ROOT"
"$ROOT/scripts/launcher/build.sh" >/dev/null
mkdir -p "$GAMEPACK_DIR" "$TRACE_DIR"

python3 - "$CONFIG" "$GAME_FILTER" <<'PY' |
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    config = json.load(f)

game_filter = {name for name in sys.argv[2].split(",") if name}
for game in config["games"]:
    if game_filter and game["internalName"] not in game_filter:
        continue
    print("\t".join([
        game["internalName"],
        game["mainClass"],
        str(game["gamecrc"]),
        game["gamepackHash"],
    ]))
PY
while IFS=$'\t' read -r internal main_class gamecrc hash; do
  jar="$GAMEPACK_DIR/$internal.jar"
  url="$STATIC_BASE/$internal.jar"
  trace="$TRACE_DIR/$internal.trace"
  stdout="$TRACE_DIR/$internal.stdout"
  stderr="$TRACE_DIR/$internal.stderr"

  if [[ ! -f "$jar" ]] || [[ "$(sha256sum "$jar" | awk '{print $1}')" != "$hash" ]]; then
    echo "fetch jar $internal"
    curl -fsSL "$url" -o "$jar"
  fi

  actual_hash="$(sha256sum "$jar" | awk '{print $1}')"
  if [[ "$actual_hash" != "$hash" ]]; then
    echo "FATAL: hash mismatch for $internal: expected $hash got $actual_hash" >&2
    exit 1
  fi

  echo "warm cache $internal"
  set +e
  java -Djava.awt.headless=false -jar "$ROOT/.work/launcher/dekobloko-launcher.jar" \
    --awt fake \
    --gamepack "$jar" \
    --main-class "$main_class" \
    --gamecrc "$gamecrc" \
    --server "$SERVER" \
    --headless-init \
    --sleep-ms "$SLEEP_MS" \
    --trace-file "$trace" >"$stdout" 2>"$stderr"
  status=$?
  set -e
  if [[ "$status" -ne 0 ]]; then
    echo "WARN: warm failed for $internal status=$status; see $stderr" >&2
  fi
done

echo "cache warm complete"
