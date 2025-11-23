#!/bin/bash
set -e

# Deploy to Fly.io from monorepo root
# This ensures the build context includes all workspace files
cd "$(dirname "$0")/../.." || exit 1
fly deploy --config packages/server/fly.toml
