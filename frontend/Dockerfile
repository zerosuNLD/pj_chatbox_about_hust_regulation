# =============================================================================
# HUST Q&A — Frontend Dockerfile (Multi-stage build)
# =============================================================================

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies (cached layer)
COPY package*.json ./
RUN npm ci

# Build arguments — can be overridden via docker-compose
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:18-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy only what's needed to run
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "start"]
