# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# Copy only what's needed to run
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY public/ ./public/

EXPOSE 8080

CMD ["node", "dist/server.js"]
