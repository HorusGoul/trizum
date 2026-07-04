#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
PLATFORM="${1:-all}"

export FASTLANE_DISABLE_COLORS=1
export FASTLANE_HIDE_CHANGELOG=1
export FASTLANE_OPT_OUT_USAGE=1
export FASTLANE_SKIP_UPDATE_CHECK=1

start_group() {
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    echo "::group::$1"
  else
    echo "==> $1"
  fi
}

end_group() {
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    echo "::endgroup::"
  fi
}

check_ruby_syntax() {
  local file="$1"
  bundle exec ruby -c "$file" >/dev/null
}

check_fastlane_bundle() {
  local label="$1"
  local directory="$2"
  shift 2

  start_group "$label Ruby bundle"
  set +e
  (
    cd "$directory"

    bundle check

    for file in "$@"; do
      check_ruby_syntax "$file"
    done

    bundle exec fastlane lanes
  )
  local status=$?
  set -e
  end_group
  return "$status"
}

check_ios_podfile() {
  start_group "iOS CocoaPods Podfile"
  set +e
  (
    cd "$SCRIPT_DIR/ios/App"
    bundle exec pod ipc podfile Podfile >/dev/null
  )
  local status=$?
  set -e
  end_group
  return "$status"
}

check_android() {
  check_fastlane_bundle \
    "Android Fastlane" \
    "$SCRIPT_DIR/android" \
    "Gemfile" \
    "fastlane/Appfile" \
    "fastlane/Fastfile" \
    "fastlane/Pluginfile" \
    "fastlane/Supplyfile"
}

check_ios() {
  check_fastlane_bundle \
    "iOS Fastlane" \
    "$SCRIPT_DIR/ios/App" \
    "Gemfile" \
    "Podfile" \
    "fastlane/Appfile" \
    "fastlane/Deliverfile" \
    "fastlane/Fastfile" \
    "fastlane/Pluginfile"
  check_ios_podfile
}

case "$PLATFORM" in
  android)
    check_android
    ;;
  ios)
    check_ios
    ;;
  all | both)
    check_android
    check_ios
    ;;
  *)
    echo "Usage: $0 [android|ios|all]" >&2
    exit 1
    ;;
esac
