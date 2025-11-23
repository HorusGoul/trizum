#!/bin/sh

set -e

LITESTREAM_CONFIG_PATH="/app/litestream.yml"
START_COMMAND="pnpm start"

# Start litestream replicate with exec if config exists
if [ -f "$LITESTREAM_CONFIG_PATH" ]; then
  exec litestream replicate -config "$LITESTREAM_CONFIG_PATH" -exec "$START_COMMAND"
else
  exec "$START_COMMAND"
fi