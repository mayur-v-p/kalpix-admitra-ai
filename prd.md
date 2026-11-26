# Kalpix — Complete Product Requirements (v2)

Nov 24, 2026 · @Mayur Pawar

## 1. Summary

Kalpix is a complete website where any business can create unique advertising (posters, copy and signature animated videos) from one saved business profile. Its edge is a library of signature animated styles, such as an outline that draws itself around the product and its name, and a cute mascot that "creates" the ad, combined with AI-generated video scenes. Ordinary template tools and AI video generators don't offer this combination. This document combines the original v1.0 blueprint with every change agreed since.

**Decisions made so far:**

- **A complete website for all businesses, not a WhatsApp tool.** WhatsApp is one export channel among many.
- **Signature animated styles are the core differentiator.** Outline Highlight comes first (it replaced Rope Build on 25 Nov 2026), then Mascot Presenter, then more styles and 3D.
- **Hybrid video: code-built animation plus AI-generated video.** Signature moves, text, offers, logos and end cards are built in code, so they stay cheap, consistent and always correct. AI-generated video (image-to-video from the owner's product photo) adds cinematic scenes, B-roll and motion backgrounds. Both are part of the MVP.
- **Facts come from owner-confirmed fields.** Prices, offers, dates, phone numbers and addresses are never invented by AI. They are always overlaid by templates, never generated inside AI images or AI video.
- **India-first, multi-industry.** Launch with restaurants and cafés, retail and fashion, and salons and beauty; add industries through configuration packs.
- **Validate before scaling.** A 2–3 week Outline Highlight prototype is shown to 15–20 business owners before the full MVP.

## 2. Vision, positioning and principles

**Vision.** Any business owner, with no design or video skills, can turn a promotion idea into eye-catching, branded ads in minutes.

**Positioning.** For small and growing businesses that need regular marketing content, Kalpix is an AI ad studio that produces signature animated ads, AI video, posters and copy from one saved business profile. Unlike generic AI tools or blank design canvases, it remembers the business, guides the owner step by step, and produces ads that look unlike everyday template ads.

**Problems it solves.**

- Owners need frequent promotions but have no designer or video editor.
- Template ads look the same as every competitor's.
- Resizing for every channel and re-typing business details wastes time.
- Professional video is too expensive for everyday offers.
- Generic AI tools invent prices and garble Indian-language text.

| Principle | What it means in the product |
|---|---|
| Distinctive | Every business can produce ads in signature styles that stand out in a feed. |
| Simple first | Guided choices and short forms; no prompt writing needed. |
| Brand-consistent | Logo, colours, fonts, tone and contact details reused automatically. |
| Accurate | Facts render from confirmed fields; AI never invents offers or claims. |
| Editable | AI output is a draft; owners edit text, images, colours and length. |
| Multi-format | One campaign exports to every size, channel and print. |
| Cost-aware | Code-built animation is the base layer; AI-generated video is used where it adds clear value and is charged in credits by length. |

## 3. Target users, industries and languages

Kalpix launches in India with three industries, then expands to any business through industry configuration packs.

| Segment | Main jobs | Timing |
|---|---|---|
| Restaurants, cafés, cloud kitchens | Dishes, combos, discounts, openings, events | Launch |
| Retail and fashion stores | New arrivals, seasonal sales, festival offers | Launch |
| Salons, beauty studios, spas | Services, packages, appointment offers | Launch |
| Gyms, coaching and education, real estate, hotels and travel, home services | Memberships, admissions, listings, packages | After MVP validation |
| Freelancers and marketing agencies | Ads for many clients | Reseller access early; full agency mode later |
| Franchises and multi-branch chains | Head-office templates, local details per branch | Phase 4 |
| Brands and distributors | Co-branded ads for the shops that stock them | Phase 4 |
| Any business, worldwide | Same studio, more currencies and languages | Long term |

**Personas.** Owner-operator (fast, simple, guided); store manager (correct prices, reusable offers); freelancer or agency (many brand kits, approvals); growing-business marketer (variants, testing, results).

**Industry configuration packs.** Each industry is defined as data, not code: form fields, templates, calls to action, mascot outfits, AI video scene prompts, festival calendar, compliance warnings and copy styles. Adding an industry means adding a pack.

**Languages.** English, Hindi, Marathi and Hinglish at launch. Gujarati, Tamil, Telugu, Bengali, Kannada and Malayalam follow after quality checks with native speakers.

## 4. Signature animated styles and AI video

Each signature style is a reusable, code-built animation recipe that can include AI-generated video scenes. The owner supplies a product photo, logo and offer, and the website renders a unique 10–20 second video in their brand.

### 4.1 Outline Highlight (first style)

*Changed 25 Nov 2026: replaces the earlier "Rope Build" style, which drew the product with an animated rope. The rope did not look clean enough on real product photos, so it was removed.*

Everything appears THROUGH its outline. The brand name and the product name are drawn letter by letter (each letter's outline traces itself) and then fill in. The product is drawn by its own outline, sketched, then coloured in. No rings or frames are drawn around anything. *(Clarified with the owner on 25 Nov 2026.)*

| Time | What happens on screen |
|---|---|
| 0.2–2 s | The brand name is drawn letter by letter, then fills in. |
| 1.8–4.2 s | The product's outline is drawn on its own edge (including details such as steam). |
| 3.6–5.4 s | Sketch lines of the product's details appear, top to bottom. |
| 4.8–6.6 s | Colour fills the product from the bottom up; a small sparkle when complete. |
| 6.2–8.2 s | The product name is drawn letter by letter, then fills in. |
| 8.5–12 s | The offer pops in, with the price and dates (confirmed facts only). |
| 13–15 s | Closing card: logo, business name, offer, call to action, contact. |

- **Line styles:** brand colour, neon glow, gold.
- **Owner controls:** line style, brand colours, headline, aspect ratio (later: speed, music).
- **AI-enhanced product (requested 25 Nov 2026):** the product does not have to be the exact photo. When an image AI provider is connected (FR-20), an AI-enhanced version of the product is generated, the owner picks one, and the animation draws that instead. Until then the uploaded photo is used. *(Built in M6 with a test-mode provider that returns the image unchanged; the owner's choice, and its use in every ad and export, already work.)*
- **How it works:** the product's shape is found in the photo (transparent cutout or plain background) and smoothed into one outline. Thin extras such as steam stay visible but get no outline of their own. If no clear shape is found, the product sits in a neat rounded frame and the outline goes around that.
- **3D version (later):** the same outline as a lit 3D stroke with camera moves.

### 4.2 Mascot Presenter

A small, cute animated character walks on screen and "creates" the ad.

| Time | What happens on screen |
|---|---|
| 0–2 s | The mascot walks or hops in and waves. |
| 2–6 s | It opens a box, paints on an easel or taps a floating screen. |
| 6–10 s | The owner's product, poster or clip appears from that action. |
| 10–14 s | It points at the offer as the price pops up; optional voice line. |
| 14–20 s | It celebrates beside the end card. |

- Kalpix designs its own original mascot; it must not resemble any existing character.
- Built once as a rigged character with an action library: walk in, wave, paint, unbox, unveil, point, cook, cut hair, hand over a bag, celebrate.
- Industry outfits (chef's apron, salon scissors, shopping bags), background scenes, and voice lines in supported languages.
- Later: each business creates its own mascot (face, outfit, colours) that appears in all its ads.

### 4.3 AI-generated video scenes (hybrid)

AI video generation creates the cinematic parts of an ad, and code-built templates add everything that must be exact.

- **What AI video makes:** image-to-video clips from the owner's product photo (steam rising from a dish, fabric moving, a slow camera push-in on a salon interior), motion backgrounds, and short B-roll scenes for the industry.
- **What code adds on top:** the signature moves (outline highlight, mascot), all text, prices, offers, logo, QR code, the end card and the music timing.
- **Where it appears:** as an opening scene before a signature style, as the background behind Outline Highlight or the mascot, or as a standalone "AI Scene" ad with template text overlays and the brand end card.
- **Guided, not prompted:** owners pick a scene type from the industry pack (for example "sizzling close-up", "festive lights", "store walk-through"); the system writes the AI prompt.
- **Two modes:** *composite* (default): the AI clip is the scene or background, and the real product cutout is layered on top by code, so the product cannot be distorted. *Animated product*: the AI animates the product photo itself. The owner must approve it, and can switch back to composite at any time.
- **Product fidelity:** the clip must not change how the product looks. The owner approves every clip before it can be used in an export; the first regeneration of a rejected clip is free.
- **Formats:** one master clip is generated at 9:16; 1:1 and 4:5 are cropped from it with safe margins. A separate 16:9 clip is generated only if the owner selects 16:9.
- **Cost and speed:** AI clips are generated in the background (they take minutes), cached per product and scene, reused across formats, campaigns and remixes, and charged in credits by clip length. Clip length (about 5 s) and clips per campaign are capped per plan. Until a clip is ready, the preview shows the scene's still frame.

### 4.4 More styles on the same engine

Particles assembling into the product, paper-fold reveal, ink-splash reveal, 3D product turntable, kinetic typography, and a mini store building itself in isometric 3D. New styles are new templates; the platform does not change.

### 4.5 Rules for every style

- Prices, phone numbers, addresses and dates come only from owner-confirmed fields.
- Every style renders in 9:16, 1:1, 4:5 and 16:9, plus a poster frame and a GIF preview.
- Every video ends on a brand end card.
- Text is drawn by templates, never generated inside AI images or AI video.
- AI video clips must keep the product's real appearance; the owner approves them before export.
- Music is licensed and timed so key moves land on the beat.

## 5. Functional requirements

Releases: P0 = Prototype, MVP, EF = Early follow-on, G = Growth, S = Scale (see section 11).

| ID | Feature | Requirement | Release |
|---|---|---|---|
| FR-01 | Accounts | Register, sign in (email, Google, phone OTP once TRAI DLT registration is done), reset password, manage profile, export or delete own data; free try through anonymous sign-in with captcha | MVP |
| FR-02 | Business profile | Name, industry, description, location, phone, website, languages | MVP |
| FR-03 | Quick onboarding | Import from Google Business Profile, Instagram, Swiggy/Zomato, a website link or a menu photo | EF |
| FR-04 | Brand kit | Logo variants, colours, fonts, tone, approved visual rules | MVP |
| FR-05 | Product library | Products and services with photos, prices, offers; automatic background removal | MVP |
| FR-06 | Campaign brief | Goal, product, audience, offer, price, dates, call to action, language, channels | MVP |
| FR-07 | AI ad copy | Headlines, captions, hashtags, video scripts in English, Hindi, Marathi, Hinglish | MVP |
| FR-08 | Poster Studio | Static posters, banners, carousels using brand-applied templates | MVP |
| FR-09 | Outline Highlight style | Animated outline around the product, product name and brand name per section 4.1, rendered to MP4 | P0 / MVP |
| FR-10 | Live preview | Styles play in the browser while editing; server renders only on export | MVP |
| FR-11 | Light editor | Edit text, swap images, colours, layout variant, length, music | MVP |
| FR-12 | Multi-format export | 9:16, 1:1, 4:5, 16:9; MP4, GIF, PNG, print-ready PDF | MVP |
| FR-13 | QR and links | Unique QR code and click-to-chat or website link per campaign | MVP |
| FR-14 | Campaign library | Save drafts, reopen, duplicate, search, favourites | MVP |
| FR-15 | Credits and billing | Plans, credits by render length, UPI Autopay, GST invoices, refunds on failed jobs | MVP |
| FR-16 | Admin console | Templates, styles, users, moderation, provider status, costs, audit log | MVP |
| FR-17 | Mascot Presenter | Mascot style per section 4.2 with industry outfits and actions | EF |
| FR-18 | Style Remix | Re-render one campaign in several signature styles in one click | EF |
| FR-19 | More signature styles | Particles, paper fold, ink splash, kinetic type and others | EF |
| FR-20 | AI product photoshoot | Place plain product photos into styled scenes | EF |
| FR-21 | Voice and subtitles | Text-to-speech voiceover and subtitles in supported languages | EF |
| FR-22 | Festival calendar | Upcoming occasions with auto-prepared weekly packs | EF |
| FR-23 | Beat-synced music | Animation key moves timed to the music's beats | EF |
| FR-24 | Ad variations | 3–5 labelled variants (A, B, C) for testing | EF |
| FR-25 | 3D styles | 3D outline, product turntable, isometric store scenes | G |
| FR-26 | Custom business mascot | Owner designs a personal mascot reused in all ads | G |
| FR-27 | Bulk generation | One ad per product from a catalogue or spreadsheet | G |
| FR-28 | Mini landing page | Shareable page per campaign with video, offer, map, call and order buttons | G |
| FR-29 | Results tracking | QR scans, link clicks and enquiries per ad | G |
| FR-30 | Public showcase | Opt-in gallery of real ads with "Made with Kalpix" | G |
| FR-31 | Social scheduling | Post to connected social accounts, subject to platform approval | S |
| FR-32 | Teams and agencies | Client workspaces, roles, approvals | S |
| FR-33 | Franchise mode | Head office locks templates; branches add local details | S |
| FR-34 | Brand co-op ads | Brands issue co-branded ads to stockists | S |
| FR-35 | Template marketplace | Outside designers sell styles and templates for a revenue share | S |
| FR-36 | Developer API | Other software generates ads through Kalpix | S |
| FR-37 | Print partners | Order printed banners, pamphlets and standees through partner print shops | S |
| FR-38 | AI video scenes | Image-to-video clips from product photos and industry scene types, combined with code-built styles per section 4.3; composite mode by default; template text overlays; owner approval before export; 9:16 master clip cached per product and scene | MVP |

## 6. User journey

A first-time owner should reach a usable ad in about two minutes after entering their details (a design target to validate).

1. **Visit the website.** See a live gallery of signature-style and AI video ads by industry; try one free ad without signing up (captcha, one low-resolution watermarked export per device per day, cached AI scenes only).
2. **Create an account.** Email, Google or phone OTP.
3. **Set up the business.** Choose an industry, enter details or import them from a link or menu photo.
4. **Add brand and products.** Upload logo and product photos; backgrounds are removed automatically; pick colours, language and tone.
5. **Start a campaign.** Choose a goal: sale, new product, event, festival, booking or store visit.
6. **Enter the offer.** Product, audience, offer, price, validity dates, call to action; the owner confirms each fact before it can appear in an export.
7. **Choose outputs.** Poster, Outline Highlight, Mascot Presenter, AI video scenes or other styles; pick channels and sizes.
8. **Preview live.** Styles play in the browser; AI video scenes generate in the background and drop into the preview when ready; Style Remix shows the same offer in several styles.
9. **Review and edit.** Check prices, contacts, logo and the AI clip's product appearance; edit text, images, music and length.
10. **Export and share.** Download every format, print-ready PDF and QR code, or share directly; the campaign is saved for reuse.

## 7. Website pages and user roles

| Page | Purpose | Key elements |
|---|---|---|
| Home | Explain and convert | Signature-style and AI video showcase, industries, free try, pricing, sign-up |
| Style gallery | Show what's possible | Filter by style, industry, format; "use this style" |
| Sign-up / login | Access | Email, Google, phone OTP, password reset |
| Onboarding | Capture the business fast | Industry, details, import, logo, language |
| Dashboard | Start and manage work | New campaign, recent work, festival suggestions, credits |
| Business profile | Business identity | Details, contacts, locations |
| Brand kit | Visual identity | Logos, colours, fonts, tone, mascot settings |
| Product library | Reusable catalogue | Products, photos, prices, cutouts, cached AI clips |
| Campaign brief | Describe the promotion | Goal, offer, audience, dates, CTA, language, channels |
| Studio | Create and preview | Poster and style picker, AI scene picker, live preview, Style Remix, variants |
| Editor | Final adjustments | Text, images, colours, music, length, layout |
| Export centre | Deliver | Formats, sizes, print PDF, QR code, share buttons |
| Campaign library | Reuse | Search, tags, drafts, duplicate, remix |
| Calendar | Plan ahead | Festivals, seasonal packs, scheduled campaigns |
| Results | Measure | QR scans, clicks, enquiries per ad (Growth) |
| Billing | Pay and track usage | Plan, credits, invoices, UPI Autopay |
| Admin console | Run the service | Templates, styles, moderation, costs, audit, support |
| Payment result | Confirm or retry a payment | Success page (what was unlocked, go to dashboard); failed page (retry, support email). Shows "processing" until the webhook confirms |
| Privacy Policy | Legal (required by Razorpay) | Data collected, payment data handled by Razorpay, AI providers, retention, DPDP rights |
| Terms & Conditions | Legal (required by Razorpay) | Service description, subscriptions and auto-renewal, credits, acceptable use, termination, Indian law |
| Refund & Cancellation | Legal (required by Razorpay) | Cancelling subscriptions, refund rules, automatic credit refunds for failed jobs, how to request a refund. Digital service only, no shipping |
| Contact Us | Support (required by Razorpay) | Support email, phone, business name, city |

All legal and contact pages are linked from the site footer.

| Role | Can do | Limits |
|---|---|---|
| Business owner | Everything in their workspace, including billing and team | Own workspace only |
| Team member | Create and edit assigned campaigns | Permissions set by owner |
| Agency / freelancer | Manage several client workspaces | Explicit client access; data kept separate |
| Franchise head office | Lock templates, approve branch ads | Branch data per branch |
| Platform admin | Templates, moderation, support, provider settings | Every action audited |

## 8. Accuracy, quality, privacy and compliance

| Area | Requirement |
|---|---|
| Accuracy | Business name, prices, offers, dates, phone and address render only from owner-confirmed fields. |
| Text rendering | All words, especially Devanagari and other Indian scripts, are drawn by templates, never inside AI images or AI video. |
| Product fidelity | AI video clips must not change the product's shape, colour, labels or packaging. Composite mode (real cutout over the AI scene) is the default; every clip needs owner approval before export. |
| Quality gate | Before export, automatic checks for text overflow, contrast, safe margins, missing end card and blank fields. |
| Owner approval | The owner confirms the final ad; AI output, including AI video, is labelled a draft. |
| Ease of use | Plain language, examples and defaults; works on mobile and desktop. |
| Performance | Live preview in the browser; long renders and AI video generation run in the background with progress shown. |
| Reliability | Clear status for every job; failed renders and failed AI video generations refund credits automatically. |
| Accessibility | Labelled controls, keyboard navigation, sufficient colour contrast. |
| Workspace isolation | No business can see another's files or campaigns. |
| Security | Secure sign-in, role checks, encryption in transit, secret storage, backups. |
| Data protection | Follow India's Digital Personal Data Protection (DPDP) Act for customer and user data: data stored in India, defined retention and deletion, user data export and delete. |
| Advertising standards | Warnings based on ASCI guidelines for health, finance, education and performance claims. |
| No fabrication | No invented testimonials, certifications, guarantees, before/after results, discounts or scarcity claims. |
| AI disclosure | AI-generated video is labelled where platform rules or law require it. |
| Licensed assets | Music, fonts, stock media and AI provider outputs (including AI video) used within their licence terms. |
| Original characters | Mascots and styles must not copy existing characters, logos or brand designs; uploads are checked. |
| Misuse reporting | Users can report content; admins can remove assets. |

## 9. Technical architecture

> Updated 24 Nov 2026: the stack is React + Supabase (Auth, Postgres, Storage, Edge Functions, Queues, Realtime, Cron) with a separate media worker, replacing the earlier Spring Boot + MySQL design. The detailed design, schema, functions and build order are in [architecture.md](architecture.md); where the two differ on technical detail, architecture.md wins.

Start as a modular monolith on React + Supabase, with a separate media worker for rendering, outline tracing and AI clip processing. Every AI provider, including AI video, sits behind an adapter so it can be swapped.

| Component | Technology | Role |
|---|---|---|
| Web app | React + TypeScript + Tailwind CSS | Website, studio, editor, live preview |
| Style templates | Remotion (decided 24 Nov 2026; free for individuals and very small teams, company licence needed as the team grows) | Each signature style is one parameterised code template; AI clips are layers inside it; Remotion Player for preview, Remotion renderer in the media worker |
| 3D scenes | Three.js | 3D outline, turntable, isometric scenes |
| Mascot | Rive or Lottie rigged character | Action library, outfits, lip movement |
| Auth | Supabase Auth | Email, Google, phone OTP (after DLT), anonymous sign-in with captcha for the free try |
| API / backend logic | Supabase Edge Functions + Postgres functions + row-level security | Campaigns, credits (atomic Postgres functions), permissions, job orchestration |
| AI services | Hosted LLM, background removal, image and text-to-speech APIs (called from Edge Functions) | Copy, cutouts, photoshoots, voice |
| Outline tracing | Built-in tracer (`traceOutline`), in the browser and the media worker | Outline Highlight paths |
| AI video generation | Hosted image-to-video API behind an adapter; started by an Edge Function, finished by provider webhook or polling | Product scenes, motion backgrounds, B-roll |
| Job queue | Supabase Queues (pgmq): `media_jobs` + dead-letter queue | Hands render, trace and AI clip jobs to the media worker |
| Media worker | Node + headless Chromium + FFmpeg in a container, bundled fonts; GPU worker for 3D later | Outline tracing, AI clip processing, compositing AI clips with code animation; final MP4, GIF, PNG, PDF |
| Database | Supabase Postgres (Mumbai region) | All business records, credit balances and ledger; `workspace_id` on every tenant table; RLS enforces workspace isolation |
| Storage | Supabase Storage + CDN, signed URLs | Uploads, AI clips, renders, thumbnails; licensed music kept private |
| Realtime | Supabase Realtime | Job and clip progress in the app |
| Payments | Razorpay, UPI Autopay | Plans, credit packs, GST invoices; credits granted only by the signed webhook |
| Monitoring | Sentry, logs, cost per job | Provider latency, failures, margins |

**Backend modules.** Identity and access; business profile; brand management; product library; campaign management; creative generation; AI video generation; style templates; media rendering; asset library; billing and credits; admin and observability.

**Core data entities.** User (Profile), Workspace, WorkspaceMember, PlatformAdmin, BusinessProfile, BusinessLocation, BrandKit, Mascot, Product, Campaign, CampaignProduct, StyleTemplate, AISceneType, AIVideoClip, GenerationJob, CreativeAsset, QRLink, QRScan, Plan, Subscription, Payment, WebhookEvent, CreditBalance, CreditLedger, RateLimit, AuditEvent. Table names and columns are in architecture.md section 4.2.

**Job lifecycle.** `CREATED → QUEUED → PROCESSING → REVIEW_READY → COMPLETED`, or `FAILED` / `CANCELLED`.
- Credits are reserved at queue time (in the same transaction that creates and enqueues the job) and released on final failure or cancel.
- **AI clip jobs:** REVIEW_READY means the clip is saved and waiting for the owner; the owner's approval moves it to COMPLETED. Credits are consumed at REVIEW_READY. A rejected clip is CANCELLED, and its first regeneration is free.
- **Render jobs:** skip REVIEW_READY (the owner already approved the preview). They complete once every format is saved and downloadable, and credits are consumed then.
- A render can be queued only when the campaign's facts are confirmed and every AI clip it uses is COMPLETED (approved).
- Failed jobs retry up to 3 times, then go to a dead-letter queue, are marked FAILED and their credits are released.

**Cost controls.** Preview code animation in the browser and render only on export; generate one 9:16 master AI clip per product and scene and reuse it across formats, remixes and campaigns; preview AI scenes with a still frame until the clip is ready; cache cutouts, outlines, AI clips and voice tracks; 2D on CPU workers, 3D on a GPU queue; cap AI clip length, clips per campaign per plan, and retries.

## 10. Business model and growth

Prices are hypotheses to test with real owners, after calculating AI, AI video, render, storage, payment and support costs.

| Plan | Indicative price | For | Includes |
|---|---|---|---|
| Free | ₹0 | New users | A few posters and one short style video; watermarked |
| Festival pack | ~₹99 one-time | Occasional users | One ready-made festival campaign in several formats |
| Starter | ₹399/month | Solo local business | Monthly credits, brand kit, posters, Outline Highlight, a small number of AI video scenes, standard exports |
| Growth | ₹899/month | Regular campaigns | More credits, all 2D styles, mascot, more AI video scenes, voice, variants |
| Agency | ₹1,999/month | Freelancers, small agencies | Several client workspaces, shared assets, higher usage |

- Credits scale with render length and resolution; AI video scenes, 3D, voice and AI photoshoots cost more. No unlimited video in fixed plans.
- Billing: UPI Autopay, annual plans pushed before Diwali, GST invoices.
- Watermark on free exports ("Made with Kalpix") so every shared ad promotes the product.

**Growth channels.**

- Live demos to local owners using their own products.
- Freelancers, small agencies and print shops as resellers.
- Public showcase gallery for search traffic and proof.
- Partnerships with POS, billing and e-commerce software through the API.
- Franchise head offices and brands with many stockists.
- Watermarked free ads spreading on every channel.

## 11. Roadmap

Each phase ends with a test that must pass before the next starts. Timings are estimates for a solo developer using hosted AI APIs.

**Build sequence (agreed 24 Nov 2026):** the public website is built first, then the product. The P0 proof (Outline Highlight + one AI scene rendered to MP4, shown to 15–20 owners) is delivered within build milestones M4–M6. The milestone list (M0–M8) is in [architecture.md](architecture.md), "Build order".

| Phase | Indicative timing | Scope (feature IDs) | Move on when |
|---|---|---|---|
| P0. Prototype | 2–3 weeks | Outline Highlight rendering a real product photo to MP4 (FR-09), with one AI video scene behind it; shown to 15–20 owners | Owners say they would post it and pay |
| MVP | 8–10 weeks | FR-01, 02, 04–16, 38 | Pilot users create and export ads without help |
| EF. Early follow-on | 2–3 months | FR-03, 17–24 | Repeat use within 30 days; paying users |
| G. Growth | After paid traction | FR-25–30 | Render cost per ad stays within plan margins |
| S. Scale | Later | FR-31–37 | Stable operations, support and partner demand |

**Out of scope for the MVP:** automatic social posting, ad buying and budget management, conversion attribution, full agency suite, unlimited AI video, free-form AI video prompting, training own AI models, professional timeline editing.

## 12. Success metrics and open decisions

| Metric | What it tells us | How it is measured |
|---|---|---|
| Time to first ad | Speed to value | Median time from sign-up to first export |
| Activation rate | Onboarding works | Users exporting at least one ad / sign-ups |
| Style adoption | Signature styles are wanted | Share of exports that are signature-style videos, by style |
| AI video adoption | AI scenes add value | Share of exports using AI video scenes; clip approval vs. regeneration rate |
| Repeat usage | Ongoing need | Users creating another campaign within 30 days |
| Shares and downloads | Outputs are useful | Exports and shares per channel |
| Enquiries generated | Ads drive business | QR scans, link clicks, enquiries per ad |
| Correction rate | Facts are right | Edits to prices, names and contacts after generation |
| Cost per finished ad | Margins hold | AI + AI video + render + storage cost per exported ad |
| Paid conversion and churn | Business model works | Free-to-paid rate; monthly churn |

**Open decisions.**

- [ ] Final product name, after domain and trademark checks ("Kalpix" is provisional).
- [x] Rendering framework: **Remotion** (decided 24 Nov 2026). Buy the company licence before the team passes the free-licence limit.
- [ ] Mascot design: commission an illustrator or design in-house; one mascot or a small cast.
- [ ] Which three signature styles follow Outline Highlight.
- [ ] Final prices and credit amounts after cost testing and owner interviews.
- [ ] AI providers for copy, background removal, images, video and voice.
- [ ] AI video scope: exact clip length (default about 5 s), clips per campaign per plan, and which scene types each industry pack offers. Decided: 9:16 master clip, composite mode by default.

## 13. Review notes and risks (24 Nov 2026)

Points raised in review of v2, each with a suggested action. Items marked **Resolved** are designed in [architecture.md](architecture.md); the rest are still open.

- **MVP scope is large for 8–10 weeks solo, more so with AI video added.** The MVP includes UPI Autopay with GST invoices, an admin console, print-ready PDF, Poster Studio, an editor, copy in four languages and AI video scenes. *Action:* consider Razorpay payment links or manual billing first, a minimal admin console, print PDF moved to EF, and English + Hindi copy at launch.
- **AI video is the biggest cost and quality risk.** Clips cost far more per second than code rendering and take from tens of seconds to minutes. They can also warp the product, its labels or its packaging. *Action:* measure cost and time per clip with 2–3 providers during P0. **Partly resolved:** composite mode by default, a 9:16 master clip, caching and reuse, owner approval and per-plan caps are designed (architecture.md 5.2). Provider choice and real costs are still open.
- **Outline tracing (reduced risk).** The rope animation was dropped on 25 Nov 2026 because traced paths did not look clean enough; the new Outline Highlight only draws a smoothed outline around the product and falls back to a rounded frame when no clear shape is found. *Action:* still test on 10+ real shop photos.
- **India-specific setup is missing.** Phone OTP by SMS needs TRAI DLT sender and template registration. GST invoices need the company's GSTIN. Importing from Swiggy, Zomato or Instagram (FR-03) may breach their terms unless done through official APIs, and Google Business Profile import needs API approval. *Action:* start DLT registration and get a GSTIN early; launch with email + Google sign-in if DLT is not ready; prefer website-link and menu-photo import (architecture.md 4.1, 4.6).
- **The validation signal is weak.** "Owners say they would post it and pay" is easy to say. *Action:* count owners who actually post the ad, or take a small deposit or pre-order.
- **There are no unit economics yet.** *Action:* measure CPU render time per 15 s video × formats, AI video cost per clip, LLM, background removal, storage and payment fees. Set a target cost per finished ad before fixing credit amounts.
- **Metrics lack numeric targets.** *Action:* set targets for activation, 30-day repeat use, correction rate, render time and cost per ad.
- **Resolved — free try abuse.** Anonymous sign-in, captcha, one low-resolution watermarked export per device/IP per day, cached AI scenes only (architecture.md 7.3).
- **Resolved — job lifecycle at REVIEW_READY.** Used only by AI clip jobs; the owner's approval moves a clip to COMPLETED. Render jobs skip it (section 9; architecture.md 4.8).
- **Resolved — credit safety.** Reserve, job insert and enqueue happen in one locked transaction; paid credits come only from the Razorpay webhook, and Cron grants only free-plan credits (architecture.md 4.3).
- **Resolved — workspace isolation.** `workspace_id` on every tenant table and one RLS rule, tested with a second account (architecture.md 4.2, 4.4).
- **Resolved — preview vs. export differences.** One shared `styles-engine` package with bundled Indian-script fonts, used by both the browser and the worker (architecture.md 3).
- **Beat-synced music (FR-23) needs data.** *Action:* store beat and downbeat timings for each licensed track.
- **Remotion licence timing.** It is free for very small teams, which suits the prototype. *Action:* decide the framework before the team grows.
- **DPDP data retention — partly resolved.** Data stays in India (Mumbai region), unconverted trial data is deleted after 7 days, and users can export or delete their data. *Action:* still set retention periods for uploads, AI clips and renders of active and cancelled accounts.
