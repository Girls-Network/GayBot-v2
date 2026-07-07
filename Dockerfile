# Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
# Licensed under the MIT Licence.
# See LICENCE in the project root for full licence information.

# ---- Stage 1: install + typecheck ----
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy only manifest files first so this layer is cached unless deps change
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Now bring in source and typecheck (fails build on TS errors)
COPY . .
RUN bun run build

# ---- Stage 2: production runtime ----
FROM oven/bun:1-alpine

WORKDIR /app

# Only prod deps in the final image
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production && \
    bun install -g @dotenvx/dotenvx

# Bring in source (tsx runs from src directly, see note below)
COPY --from=builder /app/src ./src

RUN adduser -D -u 1001 botuser && \
    mkdir -p /app/.logs /app/data && \
    chown -R botuser:botuser /app

USER botuser

EXPOSE 5000

CMD ["dotenvx", "run", "--", "bun", "run", "start"]