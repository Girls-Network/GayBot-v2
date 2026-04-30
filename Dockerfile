# Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
# Licensed under the MIT Licence.
# See LICENCE in the project root for full licence information.

# Stage 1: Typecheck (optional safety net — fails the build on TS errors)
FROM node:25-alpine AS typecheck

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

# tsc --noEmit, defined in package.json as the "test" script
RUN npm test

# Stage 2: Production
FROM node:25-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install production dependencies (tsx is now a runtime dep) AND dotenvx globally
RUN npm install --omit=dev && npm install -g @dotenvx/dotenvx

# Make sure typecheck passed before we ship this image
COPY --from=typecheck /app/src ./src
COPY tsconfig.json ./

# Get the assets over.
COPY assets ./assets

# Create a non-root user and set up directories with proper permissions
RUN adduser -D -u 1001 botuser && \
    mkdir -p /app/.logs /app/data && \
    chown -R botuser:botuser /app

# Switch to non-root user
USER botuser

EXPOSE 5000

CMD ["dotenvx", "run", "--", "npx", "tsx", "src/shard.ts"]
