# ---------- Build stage ----------
FROM node:24-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

ARG MONGO_URI
ARG GARAGE_ENDPOINT
ARG GARAGE_ACCESS_KEY
ARG GARAGE_SECRET_KEY
ARG GARAGE_BUCKET

ENV MONGO_URI=$MONGO_URI
ENV GARAGE_ENDPOINT=$GARAGE_ENDPOINT
ENV GARAGE_ACCESS_KEY=$GARAGE_ACCESS_KEY
ENV GARAGE_SECRET_KEY=$GARAGE_SECRET_KEY
ENV GARAGE_BUCKET=$GARAGE_BUCKET

RUN node scripts/download-models.mjs

RUN npm run build


# ---------- Production stage ----------
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm install --omit=dev && npm install typescript

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./

COPY --from=builder /app/lib ./lib
COPY --from=builder /app/app/actions ./app/actions
COPY --from=builder /app/scripts ./scripts

COPY --from=builder /app/node_modules/@huggingface/transformers/.cache \
     ./node_modules/@huggingface/transformers/.cache

EXPOSE 3000

CMD ["npm", "start"]
