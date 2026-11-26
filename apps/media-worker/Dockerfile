# Kalpix media worker: Node 22 + Chrome Headless Shell (Remotion) + bundled FFmpeg.
# Build from the REPO ROOT (the worker needs the shared styles engine):
#   docker build -f apps/media-worker/Dockerfile -t admitra-media-worker .
# Run (values from your secret store, never baked into the image):
#   docker run --rm -e SUPABASE_URL=... -e SUPABASE_SECRET_KEY=... admitra-media-worker
FROM node:22-bookworm-slim

# Libraries Chrome Headless Shell needs (remotion.dev/docs/docker) + Indian-script fallback fonts.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev \
      libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 \
      libcups2 ca-certificates fonts-noto-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/media-worker/package.json apps/media-worker/
COPY packages/styles-engine/package.json packages/styles-engine/
COPY packages/shared-types/package.json packages/shared-types/
RUN npm ci --workspace apps/media-worker --include-workspace-root=false --no-audit --no-fund

COPY packages/styles-engine packages/styles-engine
COPY apps/media-worker apps/media-worker
# Download the pinned Chrome Headless Shell at build time, not on every start.
RUN cd apps/media-worker && npx remotion browser ensure

# Run as an unprivileged user.
RUN useradd --create-home worker && chown -R worker /app
USER worker
ENV NODE_ENV=production RENDER_CONCURRENCY=2
CMD ["npm", "run", "start", "-w", "apps/media-worker"]
