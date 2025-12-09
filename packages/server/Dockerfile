# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=24.11.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Set production environment
ENV NODE_ENV="production"

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

# Install litestream
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ca-certificates wget && \
    wget https://github.com/benbjohnson/litestream/releases/download/v0.5.2/litestream-0.5.2-linux-x86_64.deb && \
    dpkg -i litestream-0.5.2-linux-x86_64.deb && \
    rm litestream-0.5.2-linux-x86_64.deb && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Build stage - install dependencies and prepare for deployment
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

WORKDIR /app

# Copy workspace configuration files from monorepo root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all packages (needed for workspace dependencies)
COPY packages ./packages

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Deploy stage - create production deployment
FROM base AS deploy

WORKDIR /app

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all packages
COPY packages ./packages

# Install dependencies (production only)
RUN pnpm install --frozen-lockfile --prod

# Use pnpm deploy to create a clean production deployment of the server package
# This will copy only the server package and its production dependencies
RUN pnpm deploy --filter @trizum/server --prod /app/deploy

# Final stage - minimal runtime image
FROM base AS runtime

WORKDIR /app

# Copy deployed server code
COPY --from=deploy /app/deploy ./

# Expose port
EXPOSE 3000

CMD ["/app/entrypoint.sh"]
