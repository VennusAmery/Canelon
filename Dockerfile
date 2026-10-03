# ---------- compilar el frontend ----------
FROM node:20-slim AS frontend
WORKDIR /build
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

# ----------  backend + frontend  ----------
FROM node:20-slim
WORKDIR /app
RUN corepack enable
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY backend/ ./
COPY --from=frontend /build/dist ./public-app

ENV NODE_ENV=production
CMD ["node", "server.js"]