#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)
STATUS_PATH="packages/mobile"

cd "$REPO_ROOT"

before_status=$(git status --porcelain=v1 --untracked-files=all -- "$STATUS_PATH")

"$SCRIPT_DIR/copy-client.sh"
"$SCRIPT_DIR/sync.sh" "$@"

after_status=$(git status --porcelain=v1 --untracked-files=all -- "$STATUS_PATH")

if [[ "$before_status" == "$after_status" ]]; then
  echo "Capacitor sync did not change files under $STATUS_PATH."
  exit 0
fi

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  echo "::error::Capacitor sync changed files under $STATUS_PATH. Run the mobile sync task locally and commit the generated native updates."
else
  echo "Capacitor sync changed files under $STATUS_PATH."
  echo "Run the mobile sync task locally and commit the generated native updates."
fi

echo
echo "Git status before sync:"
if [[ -n "$before_status" ]]; then
  echo "$before_status"
else
  echo "(clean)"
fi

echo
echo "Git status after sync:"
if [[ -n "$after_status" ]]; then
  echo "$after_status"
else
  echo "(clean)"
fi

echo
echo "Tracked diff:"
git diff --stat -- "$STATUS_PATH"
git diff -- "$STATUS_PATH"

untracked_files=$(git ls-files --others --exclude-standard -- "$STATUS_PATH")
if [[ -n "$untracked_files" ]]; then
  echo
  echo "Untracked files:"
  echo "$untracked_files"
fi

exit 1
