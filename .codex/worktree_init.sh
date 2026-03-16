#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

cd "$repo_root"

if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # Load nvm when available so the workspace uses the repo's pinned Node version.
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use
fi

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
