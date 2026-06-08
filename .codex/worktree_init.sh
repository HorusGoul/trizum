#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

cd "$repo_root"

if ! command -v vp >/dev/null 2>&1; then
  echo "Vite+ is required. Install the global vp CLI, then rerun this script." >&2
  exit 1
fi

vp install --frozen-lockfile
