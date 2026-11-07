# ==========================================
# Stage 1: Build TypeScript Application
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies for compilation)
COPY package*.json ./
RUN npm ci

# Copy configuration and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to /app/dist
RUN npm run build

# ==========================================
# Stage 2: Minimal Production Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install tzdata for timezone support
RUN apk add --no-cache tzdata

ENV NODE_ENV=production
ENV TZ=America/New_York

# Copy dependency definitions and install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Run as non-privileged user for security
USER node

# Start the Discord bot
CMD ["node", "dist/index.js"]

