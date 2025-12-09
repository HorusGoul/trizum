#!/bin/bash

set -e

# On macOS, sync both platforms. On other systems (Linux), only sync Android.
# This avoids Capacitor trying to run pod install on non-macOS systems.
if [[ "$(uname)" == "Darwin" ]]; then
  cap sync
else
  cap sync android
fi

