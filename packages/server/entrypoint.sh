#!/bin/sh

set -e

LITESTREAM_CONFIG_PATH="/app/litestream.yml"
DATABASE_PATH="/mnt/data/trizum.db"
SERVER_MODULE="/app/server.mjs"
START_COMMAND="node $SERVER_MODULE serve"

run_migrations() {
  node "$SERVER_MODULE" migrate
}

# Start litestream replicate with exec if config and binary exist.
if [ -f "$LITESTREAM_CONFIG_PATH" ] && command -v litestream >/dev/null 2>&1; then
  echo "Restoring database from replica"
  litestream restore -if-db-not-exists -if-replica-exists -config "$LITESTREAM_CONFIG_PATH" "$DATABASE_PATH"

  echo "Apply database migrations"
  run_migrations

  echo "Starting litestream replicate with config: $LITESTREAM_CONFIG_PATH"
  exec litestream replicate -config "$LITESTREAM_CONFIG_PATH" -exec "$START_COMMAND"
else
  echo "Apply database migrations"
  run_migrations

  echo "Starting server without litestream"
  exec node "$SERVER_MODULE" serve
fi
