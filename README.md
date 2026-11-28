# Kalpix (formerly AdMitra AI)

**A voice-first ad maker for India's small shops.** A shop owner taps the mic and says, in
Hindi, Marathi, Hinglish or English, the ad they want:

> *"Mere clothing store ke liye Diwali sale ka ad banao. Saree 1500 rupaye ki hai, 20 percent
> discount, 15 se 20 November tak, shaam 5 se 9 baje."*

Kalpix fills in the ad details (product, price, discount, dates, time), shows them on one screen
to check and change, reads them back aloud ("सही है?" — is this right?), and makes an animated
ad with the shop's product photo, ready for WhatsApp Status, Reels and posters. Prices, phone
numbers and dates are **never invented by AI**: only values the owner confirms appear on the ad.

---

## Start it with one command

Needs [Docker](https://docs.docker.com/get-docker/). No keys, no accounts.

```bash
git clone https://github.com/mayur-v-p/kalpix-admitra-ai.git
cd kalpix-admitra-ai
docker compose up --build
```

Then open **http://localhost:8080** in **Chrome or Edge** (their built-in speech recognition
powers the voice feature; other browsers can type instead).

The website connects to the hosted Kalpix backend (Supabase). The URL and the *publishable* key
in [docker-compose.yml](docker-compose.yml) are public by design (every visitor's browser gets
them). **No secret key is needed** to start the app or try the main flow.

### Try the voice flow (about 2 minutes)

1. Open **Free try** in the top menu (or http://localhost:8080/try) and press **Start my free
   try**. No sign-up or email is needed.
2. You land on **Check your ad**. Tap **Speak your ad**, allow the microphone, pick हिंदी /
   मराठी / English, and say what you want, for example the sentence above. Or just *"Mujhe Diwali
   sale ka ad chahiye"* and fill the rest later.
3. Check the list. Tap any line to change it, or press **Fill by voice** and answer Kalpix's
   questions (*"कीमत कितनी है?"*: "pandrah sau"). The sale price is worked out by code.
4. Press **Create ad**. Kalpix reads the details back; tap **हाँ, ऐड बनाइए** (or say "haan").
5. The **Studio** opens with your animated ad playing. Try **Change the details**: say
   *"discount 30 percent karo"* or *"English mein karo"*. Press **Design my ad** for six AI
   designs, then **Change the design**: *"thoda festive banao"*.

### What needs a key (and what happens without one)

| Feature | Without a key |
|---|---|
| Speak your ad, understanding the request, spoken read-back | Works: the browser's speech tools + Kalpix's own parser for Hindi/Marathi/Hinglish numbers, dates and offers |
| **AI understanding** of free-style requests (OpenAI, `OPENAI_API_KEY` on the server) | Kalpix's own parser answers instead. With the key, the AI's reading is shown on the same "Check your ad" screen, labelled "Understood by AI", and still has to be checked and confirmed |
| **AI art director**: looks at the ad's photo (what is in it, its colours and mood, a photo tip), makes 6 animated designs per tap ("Pick a look": layout, motion, colours, fonts, words) for any sector (café, clinic, gym, real estate, ...) and purpose (promote, menu, opening, festival, offer), scores each (easy to read, contrast, suits the photo) and shows the best 3 that differ, with the other 3 and why they were left out (same key) | A rule-based "surprise" designer makes 6 looks from the same kit, scored and picked the same way. Facts on the ad always come from confirmed fields; health ads cannot carry claims; property ads must show a confirmed RERA number |
| **AI edit** in the Studio ("Change the design"): say or type a change ("thoda festive banao", "bigger photo") and the design changes; "What changed" lists it; undo goes back (same key, Edge Function `edit-design`) | The suggestion buttons (More festive, Bigger photo, Use my brand colours, Shorter headline, Calmer) make simple rule-based changes. A request to change a price, offer, date, phone or address is refused either way |
| **AI ad text** in Hindi/Marathi/English (same key) | Ready-made sample lines, labelled "Test mode". The AI never writes prices, discounts, numbers or dates; the server drops any line that does |
| Animated ad preview in the Studio | Works: rendered live in the browser |
| **Ad-ready photos and AI pictures** (OpenAI `gpt-image-2`, same key): a product photo is enhanced straight away (light, colour, background; the product kept the same) and used on ads, with "Your photo" one tap away. Three **AI scenes** put the same product in new settings; a product **without a photo** gets three **AI pictures made from its name**. The owner ticks which ones ads may use, and each design in "Pick a look" can use a different one. Ads using a picture made from a name show "Image for representation only" | Photos are used as they are; a product without a photo makes text-only designs. Cut-outs (background removal) are no longer used: ads frame the whole photo |
| AI video scenes | Run in **test mode** (clearly labelled sample results) |
| Video/GIF/poster file export | Needs the render worker (`apps/media-worker`), which uses a server key; not part of the one-command start |
| Payments (Razorpay) | Shows "Payments are not switched on yet" |

---

## What's inside

```
apps/web/               React 19 + Vite + TypeScript + Tailwind website and app
  src/features/voice/   Voice: speech in/out, the Hindi/Marathi/Hinglish parser, Studio voice bar
apps/media-worker/      Remotion + FFmpeg render worker for video/GIF/poster exports
packages/styles-engine/ The animated ad templates (shared by the browser preview and the worker)
supabase/               Database migrations (row-level security), Edge Functions, 210 pgTAP tests
```

- **Voice:** Web Speech API (speech to text and text to speech), no key. Understanding is a
  rule-based parser ([parse.ts](apps/web/src/features/voice/parse.ts)) for number words
  ("pandrah sau", "पंधराशे", "dedh hazaar"), percentages, dates ("15 se 20 November"), times
  ("shaam 5 se 9 baje"), products, festivals and yes/no ("haan", "हो", "नको").
- **Accuracy:** every value is shown, editable and read back before use; the database refuses
  to export an ad with an unconfirmed price, offer, phone or address.
- **Security:** row-level security on every table, server-side checks for credits and payments,
  security audit in [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

More: [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) (plain-language summary),
[architecture.md](architecture.md), [prd.md](prd.md).

---

## Developing locally (full stack)

Needs Node 20+ and Docker Desktop.

```bash
npm install            # if npm 10 fails on this workspace, use: npx -y npm@11 install
npm run db:start       # local Supabase in Docker
npm run dev            # http://localhost:5173 on the LOCAL database
npm run dev:staging    # same site on the hosted staging backend
npm run worker         # render worker for exports (needs apps/media-worker/.env)
```

Checks:

```bash
npm run lint
npm run typecheck
npm test               # unit tests, including the voice parser
npm run db:test        # database security tests (pgTAP, needs db:start)
npm run build
```

Env files are git-ignored: `apps/web/.env.local` (staging URL + publishable key),
`apps/web/.env.development.local` (local), `supabase/.env` and `apps/media-worker/.env`
(server-only secrets, never committed).

Sample photos: [Pexels](https://www.pexels.com/), see
[apps/web/public/images/CREDITS.md](apps/web/public/images/CREDITS.md).
