#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

if command -v mise >/dev/null 2>&1; then
  mise trust mise.toml
  mise install
  exec mise exec -- vp install
else
  echo "mise is not installed; skipping native toolchain setup."
  exec vp install
fi
