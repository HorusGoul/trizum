# syntax = docker/dockerfile:1

# Node 25.7+ is required by Vite+ / tsdown executable packing.
ARG NODE_VERSION=25.7.0
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

# Pack the server and migrator as standalone executables
WORKDIR /app/packages/server
RUN vp pack

# Runtime base - no Node.js, pnpm, or Vite+
FROM debian:bookworm-slim AS runtime-base

ENV NODE_ENV="production"

WORKDIR /app

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates libatomic1 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY packages/server/entrypoint.sh ./entrypoint.sh
COPY packages/server/drizzle ./drizzle
COPY --from=build /app/packages/server/build/trizum-server ./trizum-server
COPY --from=build /app/node_modules/.pnpm/@libsql+linux-x64-gnu@0.5.22/node_modules/@libsql/linux-x64-gnu ./node_modules/@libsql/linux-x64-gnu

RUN chmod +x ./entrypoint.sh ./trizum-server

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
