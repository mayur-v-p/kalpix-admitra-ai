# Kalpix

AI ad studio for Indian businesses: signature animated ads, AI video scenes, posters and copy from one saved business profile.

## Documents

| File | What it covers |
|---|---|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Plain-language summary of the whole project (start here) |
| [prd.md](prd.md) | Product requirements: what to build |
| [architecture.md](architecture.md) | React + Supabase design, schema, security baseline, build order (M0–M8) |
| [payment-gateway.md](payment-gateway.md) | Razorpay specification (M7) |
| [security.md](security.md) | Security audit checklist, run at the end of each milestone |
| [responsivness.md](responsivness.md) | Mobile responsiveness rules and audit |

## Project layout

```
apps/web/               React + Vite + TypeScript + Tailwind website (M1: public site)
apps/media-worker/      Remotion/FFmpeg render worker (M5)
packages/styles-engine/ Shared signature-style templates (M4)
packages/shared-types/  Shared types and job schemas (M2+)
supabase/               Supabase CLI project: config, migrations, Edge Functions (M2+)
```

## Run it

Needs Node 20+ and Docker Desktop (for the local database).

```bash
npm install
npm run db:start       # local Supabase in Docker (first run downloads images)
npm run dev            # http://localhost:5173, using the LOCAL database
npm run dev:staging    # same site, using the admitra-staging project
npm run worker         # render worker for Studio exports (needs apps/media-worker/.env)
```

Exports are rendered by [apps/media-worker](apps/media-worker/README.md). Copy
`apps/media-worker/.env.example` to `apps/media-worker/.env` and add the local secret key from
`npx supabase status`. Without the worker running, exports wait in the queue.

Local services while `db:start` is running:

| What | URL |
|---|---|
| Supabase Studio (browse tables) | http://127.0.0.1:54323 |
| Mailpit (sign-up and password emails) | http://127.0.0.1:54324 |

Env files (all git-ignored): `apps/web/.env.development.local` points `npm run dev` at the local database; `apps/web/.env.local` holds the staging URL and publishable key; `apps/media-worker/.env` holds the worker's server-only secret key.

Checks:

```bash
npm run lint
npm run typecheck
npm test               # unit tests (Supabase is mocked)
npm run db:test        # database security tests (pgTAP, needs db:start)
npm run db:lint
npm run db:types       # regenerate apps/web/src/types/database.ts after a migration
npm run build
```

Database changes go in `supabase/migrations/`. Apply locally with `npm run db:reset`; push to staging with `npm run db:push:staging`.

## Before going live

Replace the `[ ... ]` placeholders in `apps/web/src/config/site.ts` (business name, support email, phone, city, grievance officer) and have a lawyer review the Privacy, Terms and Refund pages.
