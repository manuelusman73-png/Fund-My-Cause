# Stage 1: builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY apps/interface/package.json ./apps/interface/

RUN npm ci

# Copy source
COPY apps/interface ./apps/interface

# Build Next.js in standalone mode
RUN npm run build --workspace=apps/interface

# Stage 2: runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy standalone output
COPY --from=builder /app/apps/interface/.next/standalone ./
COPY --from=builder /app/apps/interface/.next/static ./apps/interface/.next/static
COPY --from=builder /app/apps/interface/public ./apps/interface/public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/interface/server.js"]
