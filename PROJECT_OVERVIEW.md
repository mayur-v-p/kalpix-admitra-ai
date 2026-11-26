# Kalpix: Project Overview

*Status as of 26 November 2026. This document is self-contained: it explains what Kalpix is, the problem it solves in India, how it works, how it is built and where development stands. The detailed specs are in [prd.md](prd.md) (requirements), [architecture.md](architecture.md) (technical design), [payment-gateway.md](payment-gateway.md), [security.md](security.md) and [responsivness.md](responsivness.md).*

---

## 1. In one sentence

**Kalpix is a website where any Indian small business can turn one product photo and an offer into eye-catching, accurate, branded ads (animated videos, posters and ad copy) in minutes, without a designer, a video editor or prompt writing.**

"Mitra" means *friend*: an ad-making friend for the local shop.

---

## 2. The problem in India

India has tens of millions of small businesses: kirana and retail stores, restaurants, cafés and cloud kitchens, salons, boutiques, coaching centres, gyms. Almost all of them now promote themselves on WhatsApp Status, Instagram, Facebook and printed posters. Their problems are the same everywhere:

| Problem | What it looks like today |
|---|---|
| **No designer, no editor** | The owner makes ads on a phone with a template app, or pays a local designer for every festival offer. |
| **Every ad looks the same** | Template apps give every shop the same Diwali poster, so nothing stands out in a feed. |
| **Video is expensive** | A professional promo video costs thousands of rupees; owners need new offers every week. |
| **AI tools get facts wrong** | Generic AI image/video tools invent prices, misspell names and garble Hindi or Marathi text inside images. One wrong price on an ad means lost money or angry customers. |
| **Repeated work** | Retyping the shop name, phone, address and logo for every ad, and resizing for every platform (status, reel, post, print). |
| **Language** | Customers respond to Hindi, Marathi and Hinglish, but most tools handle Indian scripts badly. |

**Kalpix's answer:** save the business details once, then produce ads in *signature animated styles* that ordinary tools can't make, with prices and contact details that are always exactly what the owner confirmed.

---

## 3. Who it is for

- **Launch industries:** restaurants, cafés and cloud kitchens; retail and fashion stores; salons, beauty studios and spas.
- **Next:** gyms, coaching and education, real estate, hotels and travel, home services (added as "industry packs": data, not new code).
- **Later:** freelancers and small agencies (many clients), franchises and multi-branch chains, brands that supply co-branded ads to their stockists.
- **Languages:** English, Hindi, Marathi and Hinglish at launch; more Indian languages after quality checks with native speakers.

---

## 4. How it works (the owner's journey)

1. **Sign up** with email or Google (phone OTP later).
2. **Onboard in three steps:** choose the industry → enter business details (name, phone/WhatsApp, address, languages) → set the brand kit (logo, colours, fonts, tone of voice).
3. **Add products** with a photo and price. The background is removed automatically to make a clean cutout.
4. **Confirm the facts:** the owner explicitly confirms each price, the phone number and the address. Only confirmed facts can appear on ads.
5. **Start a campaign:** goal (sale, new product, festival, event), offer, dates, call to action.
6. **Preview live** in the browser in different signature styles; edit text, colours, music and length for free.
7. **Export** every format at once: 9:16 (status/reels), 1:1, 4:5, 16:9, GIF, PNG and print-ready PDF, with a QR code and WhatsApp link.

The design target is a usable first ad about two minutes after the details are entered.

---

## 5. What makes it special

### 5.1 Signature animated styles (the main differentiator)
Ads are built from **code-based animation recipes**, not stock templates:
- **Outline Highlight (first style):** the brand name draws itself letter by letter along its outlines and fills in; the product appears through its own outline (drawn, sketched, then coloured in from the bottom up); the product name draws itself the same way; the offer pops in; a closing card shows the business, call to action, contact and a QR code. (It replaced an earlier rope animation that did not look clean enough.)
- **Mascot Presenter:** an original, cute animated character walks in and "creates" the ad (unboxes it, paints it, points at the price).
- **More on the same engine:** particles assembling the product, paper-fold and ink-splash reveals, kinetic typography, later 3D product turntables.

### 5.2 Hybrid video: code animation + AI video
- **Code animation** handles everything that must be exact: the signature moves, all text, prices, logo, QR code and end card. It is cheap, consistent and always correct.
- **AI-generated video** (image-to-video from the owner's photo) adds cinematic scenes: steam rising from chai, fabric moving, a festive background.
- By default the AI creates only the *scene*; the **real product cutout is layered on top**, so AI can never distort the product. The owner approves every AI clip.

### 5.3 Facts are never invented
- Prices, offers, dates, phone numbers and addresses come **only from fields the owner confirmed**.
- Changing a confirmed value **automatically clears its confirmation**.
- Text is **drawn by templates, never generated inside AI images**, so Hindi/Marathi spelling is always correct.
- AI is never sent prices or phone numbers to rewrite.

### 5.4 One profile, every ad
The logo, colours, fonts, tone and contact details are saved once and reused in every ad and every format.

### 5.5 Built for India
Rupee pricing with Indian digit grouping (₹1,25,000), UPI Autopay subscriptions through Razorpay, GST invoices, data hosted in India (Mumbai) under the DPDP Act, festival calendar packs, and ASCI-based warnings for risky claims.

### 5.6 Owner stays in control
AI output is always a draft; nothing is exported until the owner has checked it.

---

## 6. Responsive and accessible design

The product is designed **mobile-first**, because most Indian owners run their business from a phone.
- **Breakpoints:** mobile below 768px, tablet 768–1023px, desktop 1024px and up.
- **Readable everywhere:** body text 16px minimum, headings scale with screen size, inputs 16px (prevents iOS zoom).
- **Touch-friendly:** every button and link is at least 44×44px.
- **Navigation:** hamburger menu on phones; sidebar in the app on desktop, slide-in drawer on phones.
- **No horizontal scrolling at any width:** checked automatically at 375, 390, 768, 1024 and 1440px.
- **Accessibility:** labelled controls, keyboard navigation, visible focus, WCAG AA colour contrast, "skip to content" link, reduced-motion support for animations.
- **Look and feel:** calm, premium "billboard on concrete" editorial style (warm off-white, ink, lamp-yellow accent, thin uppercase headings) with warm hand-drawn illustrations.

---

## 7. Architecture

### 7.1 Stack

| Layer | Technology |
|---|---|
| Website and app | React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, react-hook-form + zod |
| Backend | **Supabase**: Auth, Postgres with row-level security, Storage, Edge Functions (Deno), Queues, Realtime, Cron |
| Animation | **Remotion** (React-based): the same templates play in the browser preview and render the final MP4 |
| Video rendering | A separate **media worker** (Node + headless Chromium + FFmpeg in Docker), because Edge Functions have tight CPU/memory limits |
| AI | Hosted providers behind swappable adapters: LLM for copy, background removal, image-to-video, text-to-speech |
| Payments | Razorpay (Subscriptions with UPI Autopay, Orders for one-time packs) |
| Hosting | Vercel/Netlify for the website; Supabase cloud in Mumbai; worker on a container host |
| Monorepo | `apps/web`, `apps/media-worker`, `packages/styles-engine` (shared Remotion templates), `packages/shared-types`, `supabase/` |

### 7.2 How the parts talk

```
Browser (React app, live Remotion preview)
   │  only the Supabase URL + publishable key; every request is checked by row-level security
   ▼
Supabase ── Auth · Postgres (RLS, credit functions) · Storage · Realtime · Cron
   │            │
   │            └── Queue (media_jobs) ──► Media worker: trace outlines, process AI clips,
   │                                        render MP4/GIF/PNG/PDF ──► Storage
   ▼
Edge Functions (hold all secrets) ──► AI providers · AI video provider · Razorpay
                                  ◄── signed webhooks (Razorpay, AI video)
```

### 7.3 Core data
Every business-owned table carries `workspace_id`, so one rule isolates every business:
`profiles`, `workspaces`, `workspace_members`, `platform_admins`, `business_profiles`, `business_locations`, `brand_kits`, `products`, `campaigns`, `style_templates`, `ai_scene_types`, `ai_video_clips`, `generation_jobs`, `creative_assets`, `qr_links`, `plans`, `subscriptions`, `payments`, `webhook_events`, `credit_balances`, `credit_ledger`, `rate_limits`, `audit_events`.

### 7.4 Key design rules
- **Security by the database, not the screen:** row-level security on every table, one policy per operation, and column-level grants so users can't edit protected fields (ownership, workspace, confirmations, job status, credits).
- **Secrets never reach the browser:** AI, Razorpay and SMS keys live only in Edge Functions and the worker.
- **Credits are atomic:** reserving credits, creating the job and queueing it happen in one locked database transaction; failed renders refund automatically.
- **Payments trust only signed webhooks:** the browser's "payment success" is never trusted; duplicate webhook events are ignored by event id.
- **Job lifecycle:** CREATED → QUEUED → PROCESSING → REVIEW_READY → COMPLETED (or FAILED/CANCELLED); AI clips wait for owner approval before they can be used.
- **Cost control:** preview in the browser, render only on export; cache cutouts, outlines and AI clips and reuse them; rate-limit every AI call per business.
- **Private files:** all uploads are in private buckets under the business's own folder and are shown through short-lived signed links.

---

## 8. Business model (prices are hypotheses to test)

| Plan | Price | For |
|---|---|---|
| Free | ₹0 | Try it: a few posters and one short video, watermarked |
| Festival pack | ~₹99 once | One ready-made festival campaign |
| Starter | ₹399/month | Solo local business |
| Growth | ₹899/month | Regular campaigns, all 2D styles, mascot, more AI video |
| Agency | ₹1,999/month | Freelancers and small agencies |

Credits scale with video length, resolution and AI usage; there is no unlimited video. Free exports carry a "Made with Kalpix" watermark, so every shared ad advertises the product.

---

## 9. Development progress

Built by a solo developer in milestones; each ends with tests, a security check and a responsive check.

| # | Milestone | Status |
|---|---|---|
| M0 | Specs reconciled, project and tooling set up | ✅ Done |
| M1 | Public website: home, style gallery, pricing, contact, legal pages | ✅ Done |
| M2 | Accounts (email, Google, password reset), workspaces, onboarding, business profile, brand kit | ✅ Done (local + staging) |
| M3 | Product library: photos, background-removal cutouts, confirmed prices/phone/address | ✅ Done (local + staging) |
| M4 | Outline Highlight template + Studio live preview + AI ad copy | ✅ Done (local + staging; AI copy in test mode) |
| M5 | Media worker, rendering, exports, QR codes, credits | ✅ Done (local; staging database + functions — worker not hosted yet) |
| M6 | AI video scenes, AI-enhanced product image + demos to 15–20 real owners | ✅ Built in test mode (local + staging database, functions, webhook secret); real AI providers and owner demos pending |
| M7 | Razorpay payments: plans, festival pack, billing page, signed webhook, watermark off for paid plans | ✅ Built (local); needs Razorpay test keys + dashboard plans to take a real test payment; not on staging yet |
| M8 | Free try, admin console, full security audit, launch decision | Planned |

**Quality so far:**
- 178 database security tests (cross-business access, protected columns, private files, visitors who aren't logged in, credits that can't be forged or spent twice, the export job lifecycle, AI scene cache, review and free retry, payments: duplicate webhooks, wrong amounts, out-of-order events, refunds, owner-only billing)
- 92 unit tests, including the fact gate, the AI-copy number guard, the QR rules, AI scene prompts, webhook signatures (AI video and Razorpay) and the Checkout options
- end-to-end browser tests of every M2–M5 flow, including a real export downloaded as MP4, GIF and PNG
- responsive checks at five screen widths

All pass; typecheck, lint and database lint are clean.

**How exports work (M5):** the owner picks sizes and presses Export. In one database transaction the facts are checked and snapshotted, credits are reserved (1 per size; every workspace starts with 10 free) and the job is queued. A separate render worker (Node + Remotion + headless Chrome, Docker-ready) renders each size as an MP4 video, a GIF and a PNG poster from the same template as the preview, saves them to a private bucket and spends the credits. Progress shows live in the Studio. A failed render is retried, then the credits are returned automatically. The QR code on the end card opens WhatsApp, a call or the map, and only for facts the owner confirmed.

**Placeholders today:**
- Background removal and AI ad copy run test-mode providers (original photo; sample lines); real providers plug in through one setting each.
- Business name, support contacts and legal pages are drafts that need real details and a lawyer's review before launch.

---

## 10. Open decisions

- AI providers for ad copy (M4), background removal and AI video (M6)
- Final product name and domain, after trademark checks
- Mascot design
- Which styles follow Outline Highlight
- Final prices and credit amounts, after measuring real cost per ad

Long-lead items to start early: GSTIN, TRAI DLT registration for phone OTP, a custom email sender, and Razorpay KYC.

---

## 11. Notes for anyone building on this (or a similar app)

Keep these rules; they are the product's promise:
1. **Never let AI invent or rewrite facts.** Prices, contacts, dates and offers come only from owner-confirmed fields and are drawn by templates.
2. **Never put text inside AI-generated images or video.** Overlay it with code.
3. **Isolate every business in the database** (`workspace_id` + RLS + column grants), and test it with a second account.
4. **Keep every secret server-side;** the browser gets only the publishable key.
5. **Trust only signed webhooks for money,** and make every job and payment handler idempotent.
6. **Preview free in the browser, charge only on export,** and cache expensive AI results.
7. **Design for a phone first,** with large touch targets, readable text and Indian languages.
