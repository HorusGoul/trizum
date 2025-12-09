#!/bin/sh

set -e

LITESTREAM_CONFIG_PATH="/app/litestream.yml"
DATABASE_PATH="/mnt/data/trizum.db"
START_COMMAND="pnpm start"
export COMMIT_HASH=$(git rev-parse --short HEAD)

# Start litestream replicate with exec if config exists
if [ -f "$LITESTREAM_CONFIG_PATH" ]; then
  echo "Restoring database from replica"
  litestream restore -if-db-not-exists -if-replica-exists -config "$LITESTREAM_CONFIG_PATH" "$DATABASE_PATH"

  echo "Apply database migrations"
  pnpm db:migrate

  echo "Starting litestream replicate with config: $LITESTREAM_CONFIG_PATH"
  exec litestream replicate -config "$LITESTREAM_CONFIG_PATH" -exec "$START_COMMAND"
else
  exec "$START_COMMAND"
fi