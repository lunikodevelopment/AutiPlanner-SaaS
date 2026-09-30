# AutiPlanner SaaS image.
#
# Single stage on purpose: the API runs through `tsx` so the TypeScript sources
# and the workspace packages are used directly, with no separate compile step to
# drift out of date.

FROM node:22-alpine

RUN corepack enable

WORKDIR /app

# Manifests first so a source change does not invalidate the dependency layer.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/ics/package.json ./packages/ics/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN corepack pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

# Builds the PWA into apps/web/dist, which the API serves.
RUN corepack pnpm build

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    DATA_DIR=/data \
    SERVE_WEB=true

RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /data && chown -R app:app /data
USER app

VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `node --import tsx` avoids needing pnpm (and therefore network) at runtime.
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]
