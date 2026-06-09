#!/bin/bash

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd "$SCRIPT_DIR"

run_cap_sync() {
  if command -v mise >/dev/null 2>&1 && mise which ruby >/dev/null 2>&1; then
    mise exec -- vp exec cap sync "$@"
  else
    vp exec cap sync "$@"
  fi
}

# On macOS, sync both platforms. On other systems (Linux), only sync Android.
# This avoids Capacitor trying to run pod install on non-macOS systems.
if [[ "$(uname)" == "Darwin" ]]; then
  run_cap_sync
else
  run_cap_sync android
fi
