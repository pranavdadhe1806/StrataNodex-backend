# ─── Multi-stage build for optimized production image ────────────────────────

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# ─── Stage 2: Production stage ───────────────────────────────────────────────

FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ONLY production dependencies
RUN npm ci --only=production

# Copy Prisma Client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built JavaScript from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the app
CMD ["node", "dist/index.js"]
