#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

url="${DEKOBLOKO_GAMEPACK_URL:-https://static.alterorb.net/launcher/v3/jars/dekobloko.jar}"
out="${1:-dekobloko.jar}"
expected_sha256="${DEKOBLOKO_SHA256:-a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e}"

mkdir -p "$(dirname "$out")"
curl -L --fail --output "$out" "$url"

actual_sha256="$(sha256sum "$out" | awk '{print $1}')"
if [[ "$actual_sha256" != "$expected_sha256" ]]; then
  echo "SHA256 mismatch for $out" >&2
  echo "expected: $expected_sha256" >&2
  echo "actual:   $actual_sha256" >&2
  exit 1
fi

echo "Fetched $out"
echo "SHA256 $actual_sha256"
