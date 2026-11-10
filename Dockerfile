# ---------- Build stage ----------
FROM node:24-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

ENV CLIP_CACHE_DIR=/app/model-cache
RUN node scripts/download-models.mjs
RUN npm run build


# Install the runtime dependencies used by the standalone server and indexer.
FROM node:24-slim AS production-dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Production stage ----------
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV CLIP_CACHE_DIR=/app/model-cache

ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/model-cache ./model-cache
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

CMD ["node", "server.js"]
