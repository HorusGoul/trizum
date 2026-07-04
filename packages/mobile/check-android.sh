#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

"$SCRIPT_DIR/check-sync-clean.sh" android

cd "$SCRIPT_DIR/android"

./gradlew \
  --no-daemon \
  --stacktrace \
  :app:lintDebug \
  :app:testDebugUnitTest \
  :app:assembleDebug \
  :app:bundleRelease
