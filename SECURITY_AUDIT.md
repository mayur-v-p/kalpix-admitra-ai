# Kalpix — Security Audit (M8)

26 Nov 2026 · Scope: the whole repository (web app, Supabase database, Storage, Edge Functions, media worker) against [security.md](security.md), run on the local stack, with read-only checks of the `admitra-staging` project. Supabase dashboard settings of hosted projects can't be read from code; they are listed in section 12 to check by hand.

## 1. Executive summary

- **Overall posture: good.** No Critical or High findings. Access control lives in the database (row-level security, column grants, server-side functions), not in the browser. Payments are granted only by a signed, de-duplicated webhook.
- **Findings:** 0 Critical · 0 High · 4 Medium · 5 Low · 3 Informational. Two of them (F-01 Medium, F-02 Low) were **fixed during this audit**.
- **Most serious open risk:** the hosted projects' dashboard settings (captcha, MFA, redirect URLs, email sending) aren't verified yet (F-03). After that come missing self-service data deletion and export (F-04) and leftover files after deletion (F-05).
- **Launch decision (section 15): APPROVED WITH CONDITIONS** for a closed pilot. Public launch should wait for the conditions in section 15 and the product items in PROJECT_OVERVIEW (real AI providers, hosted worker, deployed site).

## 2. Architecture and trust boundaries

Browser (React, publishable key only) → Supabase Data API (PostgREST, RLS) / Storage (policies) / Edge Functions (verify the user's token, then use the service role for checked steps) → Postgres functions. The media worker (Node, service role) runs separately and only claims queued jobs. Razorpay and the AI video provider reach the system only through signed webhooks. Untrusted inputs: everything from the browser, webhook bodies, product photos, user text that goes into AI prompts.

## 3. Supabase exposure summary

| Item | State |
|---|---|
| Keys in the browser | Supabase URL + publishable key only (`VITE_` names); Turnstile site key and Sentry DSN (both public by design) |
| Server keys | Service/secret key only in Edge Functions (server-side env) and the worker's `.env` (git-ignored) |
| Exposed schemas | `public` (and `graphql_public`); helpers live in `private`, not exposed |
| RLS coverage | 100% of `public` tables (24). 3 tables have RLS with **no** policy, deliberately deny-all: `rate_limits`, `platform_admins`, `webhook_events` |
| Visitor (anon) access | Read only `plans`, `credit_packs`, active `ai_scene_types`. No function executable by anon |
| Buckets | 4, all private, each with size limit + MIME allowlist (`product-images`, `brand-assets`, `renders`, `ai-clips`) |
| Edge Functions | 10. JWT required on 7; public by design and protected otherwise: `qr-redirect` (rate limit), `ai-video-webhook` and `razorpay-webhook` (HMAC signature) |
| Realtime | Publication limited to `generation_jobs`, `ai_video_clips`, `subscriptions`, `payments`; delivery is RLS-checked |
| Admin client | `supabase/functions/_shared/billing.ts`, the AI/billing functions, `apps/media-worker` only |

## 4. Findings

| ID | Severity | Category | Finding | Location | Exploitable | Status |
|---|---|---|---|---|---:|---|
| F-01 | Medium | Webhooks | AI video webhook marked an event handled before processing; a failure then dropped the provider's retries | `functions/ai-video-webhook` | No (availability) | **Fixed** |
| F-02 | Low | Abuse | Rate limits keyed on the first `X-Forwarded-For` value, which callers can set | `qr-redirect`, `private.request_ip_hash` | Yes, limited | **Fixed** |
| F-03 | Medium | Configuration | Hosted dashboard settings not verified from code | staging / production | Unknown | Open: manual |
| F-04 | Medium | Privacy (DPDP) | No self-service account deletion or data export | product | n/a | Open |
| F-05 | Medium | Privacy | Storage files stay after their rows are deleted (stale trials, products, accounts) | Storage | No | Open |
| F-06 | Medium | Compliance | Legal pages still have placeholders and need a lawyer's review | `config/site.ts`, legal pages | n/a | Open: owner |
| F-07 | Low | Auth | Owners are offered, not required, MFA for billing changes (architecture says required) | billing functions | No | Accepted for pilot |
| F-08 | Low | Monitoring | Sentry is wired but off (no DSN); worker errors are not reported anywhere central | `lib/monitoring.ts`, worker | n/a | Open: owner |
| F-09 | Low | Headers | CSP with Razorpay Checkout and Turnstile not yet tested on the deployed site (`style-src 'self'`) | `apps/web/vercel.json` | No | Verify at deploy |
| F-10 | Low | Resilience | No point-in-time recovery or daily backups on the free plan | Supabase plan | n/a | Open: owner |
| F-11 | Info | Privacy | Rate-limit keys use an unsalted SHA-256 of the IP (pseudonymous, deleted within a day) | `rate_limits` | No | Accepted |
| F-12 | Info | Email | Built-in Supabase email only reaches team addresses at ~2/hour: sign-up emails need a custom SMTP sender | Auth | n/a | Open: owner |
| F-13 | Info | Worker | When the worker is hosted, its service key must be a host secret (the Docker build already excludes `.env`) | `apps/media-worker` | No | Note |

### [F-01] AI video webhook could lose an event
- **Severity:** Medium · **Confidence:** High
- **Evidence:** the function inserted the event id into `webhook_events`, then called `fail_ai_clip` / `ai_clip_ready` without checking their errors, and marked the event processed regardless.
- **Attack scenario / impact:** not an attack; a database hiccup during processing left the clip stuck in "processing" with its credits reserved. The provider's retry was answered "duplicate".
- **Fix (done):** errors are checked; on failure the event id is removed and the function answers 500, so the retry is processed. Both clip functions are idempotent, so a repeat can't double-charge or loop.
- **Regression test:** API run M6 (signed webhook, forged webhook, duplicate). The failure path is covered by code review only.

### [F-02] Spoofable IP in rate limits
- **Severity:** Low · **Confidence:** High
- **Attack scenario:** a script sends a different `X-Forwarded-For` with each request to dodge the QR-scan limit or the free try's one-export-per-day limit.
- **Impact:** limited. Each free try still needs a captcha, a new anonymous account and has only 1 credit.
- **Fix (done):** prefer `cf-connecting-ip`, which Cloudflare in front of hosted Supabase sets and callers cannot fake. The first `X-Forwarded-For` entry is only a local fallback.
- **Residual:** if the app is ever hosted without Cloudflare in front, revisit.

### [F-03] Dashboard settings to verify on staging and production
See section 12. Code can't prove these: the captcha secret, anonymous sign-ins (needed for `/try`), TOTP MFA enabled, the allowed redirect URLs, email confirmation, leaked-password protection, and the SMTP sender.

### [F-04] No self-service deletion or export
- **Impact:** DPDP Act rights (access, erasure) must be honoured. Today that has to be done by hand by the team.
- **Recommended fix:** add "Download my data" and "Delete my account" to the Account page (an Edge Function that exports the workspace's rows and deletes the user plus Storage files), plus an audit event.

### [F-05] Files left after deletion
Deleting a stale trial (pg_cron), a product or an account removes rows through foreign keys, but objects in Storage stay.
- **Recommended fix:** a nightly clean-up job in the worker that deletes objects whose workspace or row no longer exists.

### [F-06] Legal pages
The pages still show placeholders (`[Registered business name]`, support email and phone, grievance officer), and the text is marked "Draft for review". Razorpay live activation and the DPDP notice both need the real details.

### [F-07] MFA for owners' billing changes
Admins need MFA (enforced in the database: `aal2`). Owners can turn MFA on, but the billing functions don't require it.
- **Accepted for the pilot.** Revisit before agency accounts with several members.

## 5. RLS coverage matrix (summary)

| Resource | Visitor | Own workspace member | Other workspace | Admin |
|---|---|---|---|---|
| Business, brand, products, campaigns | No access | Read; write allowed columns only (column grants) | No access | Admin functions only |
| Credits, ledger, jobs, assets, clips | No access | Read only; changes go through functions | No access | Admin functions only |
| Subscriptions, payments | No access | Read only; written only by the webhook function | No access | Overview totals only |
| Plans, packs, scene types | Read active | Read active | n/a | Edit through audited functions (admin + MFA) |
| webhook_events, rate_limits, platform_admins | No access | No access | No access | Service role only |

Tests: `supabase/tests/database/m2`–`m8` (210 assertions), including cross-workspace reads and writes, protected columns, and every security.md Phase 20 negative test that applies.

## 6. Function and RPC matrix

- **Callable by logged-in users (16, all `SECURITY DEFINER`, fixed `search_path`, each checks membership or admin + MFA itself):** `confirm_*` (4), `create_render_job`, `review_ai_clip`, `choose_product_image`, `billing_status`, `am_i_platform_admin`, `admin_*` (7).
- **Service role only:** the render queue (`claim/heartbeat/complete/fail_render_job`), AI clips (`reserve_ai_clip`, `mark_ai_clip_submitted`, `ai_clip_ready`, `fail_ai_clip`), billing (`billing_prepare_*`, `billing_attach`, `billing_abandon`, `billing_mark_cancel`, `process_razorpay_event`), `consume_rate_limit`.
- **Visitors:** none.

## 7. Storage security matrix

| Bucket | Public | Read | Write | Limits |
|---|---|---|---|---|
| product-images | No | Members of the workspace in the path | Members upload/delete; cutouts and enhanced images by functions | 10 MB · png/jpeg/webp |
| brand-assets | No | Members | Members (no SVG) | 5 MB · png/jpeg/webp |
| renders | No | Members (signed links) | Worker only | 50 MB · mp4/gif/png |
| ai-clips | No | Members | Worker/functions only | 50 MB · mp4/jpeg/png |

## 8. Edge Function and API matrix

| Function | Who | Checks |
|---|---|---|
| process-product-image, enhance-product-image, generate-copy, start-ai-video | Logged-in user | Token verified; ownership checked by reading the row as the user; rate limits. Free try: no enhance (403), cached scenes only |
| razorpay-create-subscription / -create-order / -cancel-subscription | Logged-in owner (not anonymous) | Token verified; owner check and price in the database; body takes a plan or pack id only |
| razorpay-webhook | Razorpay | HMAC-SHA256 over the raw body; event-id de-duplication; amount and plan check; one transaction |
| ai-video-webhook | Video provider | HMAC; event-id de-duplication; retry-safe (F-01) |
| qr-redirect | Anyone | Rate limit by hashed IP; target built only from confirmed facts |

CORS: an explicit origin list (`ALLOWED_ORIGINS`), no wildcard.

## 9. Personal data flow map

| Data | Where stored | Sent to | Notes |
|---|---|---|---|
| Email, password hash | Supabase Auth | — | Captcha on sign-up and log-in; email confirmation |
| Business name, phone, address, prices | Postgres (RLS) | Rendered into the user's own ads | Only owner-confirmed facts appear in ads |
| Product photos, logos | Private Storage | Background removal / AI providers (when real ones are connected) | Prompts carry only the cleaned product name, never prices, phones or addresses |
| Payments | Razorpay holds card/UPI data | — | We store payment ids, amount, method, status; never email, phone or card data from payloads |
| IP address | Hashed in `rate_limits` (≤1 day) | — | QR scans store no IP |
| Errors | Sentry (when switched on) | Sentry | No user data; query strings removed from URLs |

## 10. Secrets report

- **Scan of the working tree and all git history** for Supabase access tokens (`sbp_`), secret keys, Google OAuth secrets (`GOCSPX-`), Razorpay keys, JWTs and private keys: **0 hits**.
- `.env` files: none tracked; `supabase/.env`, `apps/web/.env.local`, `apps/web/.env.development.local` and `apps/media-worker/.env` are git-ignored (verified).
- The only values in `.env.development.local` / `supabase/.env` that are not secret are Cloudflare's **public test** captcha keys, used locally.
- Staging secrets (Razorpay, webhook secrets) were typed by the owner or generated without being displayed.

## 11. Automated test results

| Command | Result |
|---|---|
| `supabase test db` | 210/210 pass (7 files) |
| `npm test` | 98/98 pass |
| `npm run typecheck`, `npm run lint` | Clean |
| `supabase db lint --level warning` | No issues |
| `npm audit --omit=dev` | 0 vulnerabilities |
| API end-to-end runs (local, real Edge Functions and Auth) | M6: 21 checks · M7: 26 · M8: 25 (captcha, free-try limits, conversion, admin + real TOTP) |
| Staging probes | Visitors get 401 on all protected functions; forged webhooks rejected; private tables refused |
| Browser checks | Billing, Pricing, Try, Account, Admin at 390 px and desktop: no sideways scrolling, no console errors |

**Not covered:** a real Razorpay subscription charge (blocked by Razorpay's card-saving OTP in test mode), rendering on a hosted worker, and the CSP on a deployed site.

## 12. Manual dashboard checklist (staging, then production)

1. **Authentication → Attack protection:** captcha on, provider Turnstile, secret = your Cloudflare Turnstile secret. Then set `VITE_TURNSTILE_SITE_KEY` for the site. Do both together: captcha on without the site key blocks every log-in.
2. **Authentication → Sign In / Providers:** anonymous sign-ins **on** (for `/try`); email confirmation **on**; leaked-password protection on (paid plans).
3. **Authentication → MFA:** TOTP enabled (needed for the admin console).
4. **Authentication → URL configuration:** the site URL and redirect URLs list only your real domains (plus localhost on staging).
5. **Authentication → Emails → SMTP:** a custom sender (e.g. Resend, Amazon SES) before real users sign up.
6. **Database → Extensions:** `pg_cron` enabled, so stale trials are deleted (the migration enables it where allowed).
7. **Project settings:** MFA on your own Supabase, Razorpay and Cloudflare accounts. Production on a plan with daily backups.
8. **Razorpay (production):** live keys and webhook secret only in production; the webhook URL points to production.

## 13. Changes made during the audit

- `supabase/functions/ai-video-webhook/index.ts`: errors checked; failed events forgotten so retries work (F-01).
- `supabase/functions/qr-redirect/index.ts`, `private.request_ip_hash` (M8 migration): IP taken from `cf-connecting-ip` first (F-02).
- Low risk: no change to who can access what; covered by the existing tests (210 database, 98 unit).

## 14. Unresolved risks

- **Deferred:** F-04, F-05, F-07, F-08, F-10.
- **Unverified settings:** section 12.
- **Missing test environment:** a deployed site (CSP) and a hosted worker.
- **Accepted:** F-11; MFA optional for owners during the pilot.

## 15. Production launch decision

**APPROVED WITH CONDITIONS.** None of the automatic "not approved" triggers applies:
- no unresolved Critical or High finding
- no untested core RLS policy, and no privileged key exposed
- payments are not based on client input, and webhook signatures are verified
- no bucket is public.

Conditions before real customers:
1. Complete the section 12 checklist on the production project.
2. Real legal details and a lawyer-reviewed Privacy Policy and Terms (F-06).
3. A custom SMTP sender (F-12).
4. Sentry DSN set (F-08).
5. Deploy the site and verify Razorpay Checkout and the captcha under the CSP (F-09).
6. A written manual process for data deletion and export requests until F-04 is built.
