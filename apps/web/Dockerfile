# Kalpix website: built with Node, served by nginx.
#
#   docker compose up --build        (from the repository root)
#   open http://localhost:8080
#
# Only PUBLIC settings are passed in (the Supabase URL and its publishable key, which every
# visitor's browser receives anyway). No secret key is needed or used to build or run this.

FROM node:22-bookworm-slim AS build
WORKDIR /app
# npm 11: npm 10's installer can fail on this workspace layout.
RUN npm install -g npm@11 --no-audit --no-fund

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/media-worker/package.json apps/media-worker/
COPY packages/styles-engine/package.json packages/styles-engine/
COPY packages/shared-types/package.json packages/shared-types/
RUN npm ci --no-audit --no-fund

COPY packages packages
COPY apps/web apps/web

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_TURNSTILE_SITE_KEY=
ARG VITE_SENTRY_DSN=
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN npx vite build apps/web --config apps/web/vite.config.ts

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
