# Media worker

Renders Studio ads to downloadable files (milestone **M5**; design in
[architecture.md](../../architecture.md), section 5.3).

For each export job it renders every chosen size (9:16, 1:1, 4:5, 16:9) as:

- **MP4**: H.264, 1080p class, 15 s
- **GIF**: 480 px wide, 10 fps, loops (for WhatsApp)
- **PNG**: the poster frame (product, name and offer on screen)

It uses the same Remotion template and the same fact gate (`buildAdProps`) as the browser
preview, from `@admitra/styles-engine`. The exported ad therefore always matches the preview,
and it shows only confirmed facts.

## How a job flows

1. The Studio calls `create_render_job`. In one transaction the database checks the facts,
   snapshots them, reserves the credits and queues the job.
2. This worker claims the job with `claim_render_job`, under a lease, and renders it. It
   reports progress with `heartbeat_render_job`; the Studio sees it live through Realtime.
3. The files go to the private `renders` bucket (`{workspace}/{job}/...`) and are listed in
   `creative_assets`. Then `complete_render_job` spends the reserved credits.
4. If a render fails, `fail_render_job` retries it up to 3 attempts, then marks the job FAILED
   and returns the credits. If a worker crashes, its lease runs out and another worker takes
   the job.

## Run locally

```sh
cp apps/media-worker/.env.example apps/media-worker/.env   # then fill in SUPABASE_SECRET_KEY
npm run dev -w apps/media-worker
```

`npx supabase status` shows the local secret key. **Never** put the staging or production
key in a file that is committed, or in any `VITE_` variable.

The first start downloads Chrome Headless Shell (about 100 MB). Each 15-second size takes a few
minutes on a laptop with `RENDER_CONCURRENCY=1`; a 2 vCPU / 4 GB container is faster.

## Docker

```sh
docker build -f apps/media-worker/Dockerfile -t admitra-media-worker .
docker run --rm -e SUPABASE_URL=... -e SUPABASE_SECRET_KEY=... -e QR_BASE_URL=... admitra-media-worker
```

## Licensing

Remotion is free for individuals and companies of up to 3 people. Larger companies need a
company license (remotion.dev/license); set `REMOTION_LICENSE_KEY` when you have one.
