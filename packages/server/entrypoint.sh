#!/bin/sh

set -e

LITESTREAM_CONFIG_PATH="/app/litestream.yml"
DATABASE_PATH="/mnt/data/trizum.db"
MIGRATE_COMMAND="/app/trizum-server"
MIGRATE_COMMAND_ARG="migrate"
START_COMMAND="/app/trizum-server"
START_COMMAND_ARG="serve"

# Start litestream replicate with exec if config and binary exist.
if [ -f "$LITESTREAM_CONFIG_PATH" ] && command -v litestream >/dev/null 2>&1; then
  echo "Restoring database from replica"
  litestream restore -if-db-not-exists -if-replica-exists -config "$LITESTREAM_CONFIG_PATH" "$DATABASE_PATH"

  echo "Apply database migrations"
  "$MIGRATE_COMMAND" "$MIGRATE_COMMAND_ARG"

  echo "Starting litestream replicate with config: $LITESTREAM_CONFIG_PATH"
  exec litestream replicate -config "$LITESTREAM_CONFIG_PATH" -exec "$START_COMMAND $START_COMMAND_ARG"
else
  echo "Apply database migrations"
  "$MIGRATE_COMMAND" "$MIGRATE_COMMAND_ARG"

  echo "Starting server without litestream"
  exec "$START_COMMAND" "$START_COMMAND_ARG"
fi
