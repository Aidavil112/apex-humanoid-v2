# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# APEX Humanoid — production image
#   build:  docker build -t apex-humanoid .
#   run:    docker run -p 3000:3000 --env-file .env apex-humanoid
# ---------------------------------------------------------------------------

# ---------- stage 1: build the Vite frontend ----------
FROM node:20-alpine AS build
WORKDIR /app
ENV CI=true

# deps first (layer cache friendly)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- stage 2: tiny runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# production deps only (tsx stays: it runs server.ts)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# app code + built frontend
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/icon-180.png /app/icon-512.png ./

RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "server.ts"]
