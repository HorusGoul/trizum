#!/bin/bash

SENTRY_ORG="horusdev"
SENTRY_PROJECT="trizum-pwa"

vite build

sentry-cli sourcemaps inject ./dist/client

if [ -z "$SENTRY_AUTH_TOKEN" ]; then
  echo "SENTRY_AUTH_TOKEN is not set, skipping sourcemaps upload"
  exit 0
fi

# Get full version
PWA_VERSION=$(pnpm pkg get version | xargs)
LAST_COMMIT="$(git rev-parse --short HEAD)"
FULL_VERSION="${PWA_VERSION}-${LAST_COMMIT}"

echo "Uploading sourcemaps to Sentry for release $FULL_VERSION. Org: $SENTRY_ORG, Project: $SENTRY_PROJECTS"

sentry-cli sourcemaps upload \
  --release "$FULL_VERSION" \
  --org "$SENTRY_ORG" \
  --project "$SENTRY_PROJECT" \
  ./dist/client
