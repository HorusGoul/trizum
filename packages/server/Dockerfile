# syntax = docker/dockerfile:1

ARG NODE_VERSION=24.11.1
ARG LITESTREAM_VERSION=0.5.2
ARG VITE_PLUS_VERSION=0.1.24
FROM node:${NODE_VERSION}-slim AS build
ARG TARGETARCH
ARG VITE_PLUS_VERSION

LABEL fly_launch_runtime="Node.js"

# Set production environment
ENV NODE_ENV="production"

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential ca-certificates git pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives && \
    npm install -g vite-plus@${VITE_PLUS_VERSION}

WORKDIR /app

# Copy workspace configuration files from monorepo root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY AGENTS.md ./
COPY scripts/apply-vite-plus-agent-overrides.mjs ./scripts/apply-vite-plus-agent-overrides.mjs

# Copy workspace manifests before sources so dependency install stays cached.
COPY packages/icon-sprite/package.json ./packages/icon-sprite/package.json
COPY packages/logging/package.json ./packages/logging/package.json
COPY packages/mobile/package.json ./packages/mobile/package.json
COPY packages/pwa/package.json ./packages/pwa/package.json
COPY packages/screenshots/package.json ./packages/screenshots/package.json
COPY packages/server/package.json ./packages/server/package.json
COPY packages/ts-template/package.json ./packages/ts-template/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json

# Install all dependencies through Vite+
RUN vp install --frozen-lockfile

# Copy all package sources after dependencies are installed.
COPY packages ./packages

# Build workspace packages needed by the server runtime
RUN vp run --filter @trizum/logging build

# Pack the server and migrator as a standalone Node module
WORKDIR /app/packages/server
RUN vp pack

# Normalize target-specific native packages into a stable path for runtime COPY.
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) libsql_arch="x64" ;; \
      arm64) libsql_arch="arm64" ;; \
      *) echo "Unsupported TARGETARCH for @libsql native package: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    mkdir -p /app/runtime-node-modules/@libsql; \
    libsql_dir="$(find /app/node_modules/.pnpm -path "*/node_modules/@libsql/linux-${libsql_arch}-gnu" -type d | head -n 1)"; \
    if [ -z "$libsql_dir" ]; then \
      echo "Could not find @libsql/linux-${libsql_arch}-gnu in node_modules" >&2; \
      exit 1; \
    fi; \
    cp -a "$libsql_dir" "/app/runtime-node-modules/@libsql/linux-${libsql_arch}-gnu"

# Runtime base - Node.js without pnpm or Vite+
FROM node:${NODE_VERSION}-slim AS runtime-base

ENV NODE_ENV="production"

WORKDIR /app

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates libatomic1 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY packages/server/entrypoint.sh ./entrypoint.sh
COPY packages/server/drizzle ./drizzle
COPY --from=build /app/packages/server/build/cli.mjs ./server.mjs
COPY --from=build /app/runtime-node-modules ./node_modules
COPY --from=build /app/node_modules/.pnpm/@sentry-internal+node-cpu-profiler@2.2.0/node_modules/@sentry-internal/node-cpu-profiler ./node_modules/@sentry-internal/node-cpu-profiler
COPY --from=build /app/node_modules/.pnpm/detect-libc@2.1.2/node_modules/detect-libc ./node_modules/detect-libc
COPY --from=build /app/node_modules/.pnpm/node-abi@3.85.0/node_modules/node-abi ./node_modules/node-abi
COPY --from=build /app/node_modules/.pnpm/semver@7.7.3/node_modules/semver ./node_modules/semver

RUN chmod +x ./entrypoint.sh

# Expose port
EXPOSE 3000

CMD ["/app/entrypoint.sh"]

# Local runtime image without Litestream for smoke testing.
FROM runtime-base AS runtime-local

# Production runtime image with Litestream replication.
FROM runtime-base AS runtime

ARG LITESTREAM_VERSION
ARG TARGETARCH

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y wget && \
    case "$TARGETARCH" in \
      amd64) litestream_arch="x86_64" ;; \
      arm64) litestream_arch="arm64" ;; \
      *) echo "Unsupported TARGETARCH for Litestream: $TARGETARCH" >&2; exit 1 ;; \
    esac && \
    wget -O litestream.deb "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-${litestream_arch}.deb" && \
    dpkg -i litestream.deb && \
    rm litestream.deb && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY packages/server/litestream.yml ./litestream.yml
