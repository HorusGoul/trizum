# syntax = docker/dockerfile:1

ARG NODE_VERSION=24.11.1
ARG VITE_PLUS_VERSION=0.1.24
FROM node:${NODE_VERSION}-slim AS build

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
COPY --from=build /app/node_modules/.pnpm/@libsql+linux-x64-gnu@0.5.22/node_modules/@libsql/linux-x64-gnu ./node_modules/@libsql/linux-x64-gnu
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

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y wget && \
    wget https://github.com/benbjohnson/litestream/releases/download/v0.5.2/litestream-0.5.2-linux-x86_64.deb && \
    dpkg -i litestream-0.5.2-linux-x86_64.deb && \
    rm litestream-0.5.2-linux-x86_64.deb && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY packages/server/litestream.yml ./litestream.yml
