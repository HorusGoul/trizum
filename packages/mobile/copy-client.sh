#!/bin/bash

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd $SCRIPT_DIR;

DIST_DIR="dist"
PWA_DIR="../pwa"
CLIENT_DIR="$PWA_DIR/dist/client"

if [ -d "$DIST_DIR" ]; then
  echo "Cleaning up $DIST_DIR directory"
  rm -rf $DIST_DIR
fi

if [ -d "$CLIENT_DIR" ]; then
  echo "Copying client files from $CLIENT_DIR to $DIST_DIR"
  cp -r $CLIENT_DIR $DIST_DIR
else
  echo "Client directory $CLIENT_DIR does not exist"
  echo "Running pnpm build in $CLIENT_DIR"

  pushd "$PWA_DIR"
  pnpm build
  popd

  echo "Copying client files from $CLIENT_DIR to $DIST_DIR"
  cp -r $CLIENT_DIR $DIST_DIR
fi

echo "Done"