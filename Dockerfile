
# ---- STAGE 1: BASE ----
FROM public.ecr.aws/docker/library/node:22-trixie-slim AS base-builder
ENV TURBO_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@12.6.0 turbo @nestjs/cli
WORKDIR /usr/src/app
COPY . .

# ---- STAGE 2: PRUNE ----
FROM base-builder AS pruner
RUN turbo prune backend frontend --docker

# ---- STAGE 3: BUILD ----
FROM base-builder AS builder
COPY --from=pruner /usr/src/app/out/json/ .
COPY --from=pruner /usr/src/app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY --from=pruner /usr/src/app/out/full/ .

ARG LOCAL_BUILD
ENV NODE_TLS_REJECT_UNAUTHORIZED=${LOCAL_BUILD:+0}

RUN turbo build --filter=backend --filter=frontend

# ---- STAGE 4: RUN APP ----
# FROM public.ecr.aws/docker/library/node:22-trixie-slim
FROM gcr.io/distroless/nodejs22-debian13:nonroot
WORKDIR /usr/src/app

# Copy root
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy API contract
COPY --from=builder /usr/src/app/packages/api-contract/dist ./packages/api-contract/dist
COPY --from=builder /usr/src/app/packages/api-contract/node_modules ./packages/api-contract/node_modules
COPY --from=builder /usr/src/app/packages/api-contract/package.json ./packages/api-contract/package.json

# Copy DB
COPY --from=builder /usr/src/app/packages/db/dist ./packages/db/dist
COPY --from=builder /usr/src/app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /usr/src/app/packages/db/package.json ./packages/db/package.json

# Copy frontend assets
COPY --from=builder /usr/src/app/apps/frontend/dist ./apps/frontend/dist

# Copy compiled backend
COPY --from=builder /usr/src/app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /usr/src/app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /usr/src/app/apps/backend/package.json ./apps/backend/package.json

EXPOSE 8080

CMD ["apps/backend/dist/main.js"]
# CMD ["sleep", "infinity"]