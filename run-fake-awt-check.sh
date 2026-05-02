#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
exec ./run-trace-test.sh
