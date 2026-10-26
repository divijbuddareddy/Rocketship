# ==============================================================================
# Production Dockerfile for AI Automation Labs Connect
# ==============================================================================

# 1. Build Stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig*.json ./
RUN npm ci

COPY server ./server
COPY public ./public
RUN npm run build

# 2. Production Runtime Stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/src/database/schema.sql ./dist/server/src/database/schema.sql
COPY public ./public

EXPOSE 3000

USER node
CMD ["node", "dist/server/src/index.js"]
