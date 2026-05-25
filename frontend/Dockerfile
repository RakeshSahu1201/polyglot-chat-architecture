# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Cache dependency layer
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Env vars for Vite build (baked into the static bundle at build time)
ARG VITE_AUTH_URL=http://localhost/api/auth
ARG VITE_CHANNEL_URL=http://localhost/api/channels
ARG VITE_SERVER_URL=http://localhost/api/chat
ARG VITE_IPFS_GATEWAY_URL=http://localhost/ipfs

ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_CHANNEL_URL=$VITE_CHANNEL_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_IPFS_GATEWAY_URL=$VITE_IPFS_GATEWAY_URL

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config for SPA routing
COPY nginx.frontend.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
