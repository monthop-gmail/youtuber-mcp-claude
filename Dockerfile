# Build stage
FROM node:22-slim AS builder

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

# Copy source and build
COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:22-slim

# Install runtime dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm pkg delete scripts.prepare && npm ci --omit=dev

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite databases
RUN mkdir -p /app/data

# Expose SSE port
EXPOSE 3000

# Default to SSE mode for Docker
CMD ["node", "dist/server-sse.js"]
