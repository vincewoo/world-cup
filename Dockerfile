# ── Stage 1: build the SPA ────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first (layer-cached unless package.json changes)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: minimal production image ─────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Only copy what the production server needs
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/server      ./server
COPY --from=builder /app/package.json ./

EXPOSE 8080

# FOOTBALL_DATA_TOKEN is injected at runtime via `fly secrets set`
CMD ["node", "server/proxy.mjs"]
