# Copyright (c) 2026 Girls Network
# Licensed under the MIT Licence.
# See LICENCE in the project root for full licence information.

# Stage 1: Build
FROM node:25-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:25-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install production dependencies AND dotenvx globally
RUN npm install --omit=dev && npm install -g @dotenvx/dotenvx

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Get the assets over.
COPY assets ./assets

# Create a non-root user and set up directories with proper permissions
RUN adduser -D -u 1001 botuser && \
    mkdir -p /app/.logs /app/data && \
    chown -R botuser:botuser /app

# Switch to non-root user
USER botuser

# Start the bot with dotenvx
CMD ["dotenvx", "run", "--", "npm", "start"]