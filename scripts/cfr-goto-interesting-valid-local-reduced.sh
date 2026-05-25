#!/usr/bin/env bash
set -euo pipefail

"$(cd "$(dirname "$0")" && pwd)/cfr-goto-interesting-valid-local.sh" reduced-valid.j
