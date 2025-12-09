#!/bin/bash
set -e

# Deploy to Fly.io from monorepo root
# This ensures the build context includes all workspace files
cd "$(dirname "$0")/../.." || exit 1

COMMIT_HASH=$(git rev-parse --short HEAD)

fly deploy --config packages/server/fly.toml --env COMMIT_HASH="$COMMIT_HASH"
