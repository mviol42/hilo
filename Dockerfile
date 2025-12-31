# Multi-stage Dockerfile for Hi-Lo game server
# Build with: docker build --platform linux/amd64 -t hilo .

# Stage 1: Build all TypeScript code
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package file
COPY package.json ./

# Copy workspace package files
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies (including devDependencies for building)
# Use npm install instead of npm ci to resolve platform-specific optional deps
RUN npm install

# Copy source code
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build shared package
WORKDIR /app/shared
RUN npm run build

# Build backend
WORKDIR /app/backend
RUN npm run build

# Build frontend (static assets)
WORKDIR /app/frontend
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS production

# Install wget for health checks
RUN apk add --no-cache wget

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Configure npm for better network resilience
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5

WORKDIR /app

# Copy root package file
COPY package.json ./

# Copy workspace package files
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install only production dependencies
RUN npm install --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy shared package.json (needed for runime)
COPY --from=builder /app/shared/package.json ./shared/

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the server
WORKDIR /app/backend
CMD ["node", "dist/index.js"]
