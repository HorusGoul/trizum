#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

cd "$repo_root"

node_version="$(tr -d '[:space:]' < .node-version)"
current_node_version="$(node --version | sed 's/^v//')"
node_version_matches=false

if [[ "$node_version" == *.* ]]; then
  if [ "$current_node_version" = "$node_version" ]; then
    node_version_matches=true
  fi
else
  current_node_major="${current_node_version%%.*}"
  if [ "$current_node_major" = "$node_version" ]; then
    node_version_matches=true
  fi
fi

if [ "$node_version_matches" != "true" ]; then
  echo "Expected Node $node_version from .node-version, found $current_node_version." >&2
  echo "Install or activate the pinned Node version before rerunning this script." >&2
  exit 1
fi

if ! command -v vp >/dev/null 2>&1; then
  echo "Vite+ is required. Install the global vp CLI, then rerun this script." >&2
  exit 1
fi

vp install --frozen-lockfile
