# AdMitra AI — Payment Gateway Specification (Razorpay)

Nov 24, 2026 · Companion to [prd.md](prd.md) and [architecture.md](architecture.md) (section 6). Built in milestone **M7**.

This replaces the earlier generic payment prompt. Where that prompt clashed with the architecture (Express routes, client-sent prices, client-side "verify" granting access, `isPaid` columns on users, secrets pasted into chat), this document follows the architecture.

AdMitra is a SaaS product. There is no physical delivery; access is digital and granted only after Razorpay confirms the payment through a signed webhook.

## Status (Nov 26, 2026): built in M7, locally

Everything below is built and tested locally (178 database tests, 92 unit tests, a 26-check API run that signs webhook events like Razorpay). A real test payment needs the owner's Razorpay **test** keys and the plans created in the Razorpay dashboard (section 9). Plan credits are hypotheses: Free 10 once, Starter 60/month, Growth 150/month, Agency 400/month, Festival pack 15 credits + no watermark for 30 days.

## 1. Answers to the setup questions

| Question | Answer |
|---|---|
| Gateway | Razorpay (Subscriptions with UPI Autopay + Orders for one-time packs) |
| Credentials | Never pasted into chat or committed. The owner types them into local `.env` / Supabase secrets |
| Frontend | React + Vite + TypeScript (hosted on Vercel) |
| Backend | Supabase Edge Functions (Deno) + Postgres functions |
| Database | Supabase Postgres |
| What is sold | Monthly plans (Starter ₹399, Growth ₹899, Agency ₹1,999), Festival pack (~₹99 one-time). Annual plans later. Prices are hypotheses (PRD section 10) |
| Legal pages | Privacy, Terms, Refund & Cancellation, Contact, Pricing; built in M1 and linked from the footer |
| After payment | The workspace's subscription becomes active and the plan's monthly credits are added. A pack adds its campaign credits. The user lands on the dashboard with the new balance |

## 2. Before writing code (M7 start)

Check the current official Razorpay docs and record the API and SDK versions used:
- Subscriptions API and the UPI Autopay mandate flow
- Orders API
- Checkout.js (loaded from Razorpay's CDN)
- Webhook signature verification (HMAC SHA256 of the raw body with the webhook secret)
- Webhook event list and the `x-razorpay-event-id` header

The official Node SDK does not run cleanly in Deno Edge Functions. If so, call the REST API with `fetch` and Basic auth, and say so in code comments.

## 3. Secrets and configuration

| Name | Where it lives | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | Supabase Edge Function secret | Also returned to the browser by the create functions (a public key id is safe to show) |
| `RAZORPAY_KEY_SECRET` | Supabase Edge Function secret only | Never in the browser, never with a `VITE_` prefix |
| `RAZORPAY_WEBHOOK_SECRET` | Supabase Edge Function secret only | Separate values for test and live |

Test mode keys are used in local development and staging; live keys only in production. `.env.example` lists the names with empty values.

## 4. Data model (from architecture.md 4.2)

There are no payment columns on users: plans belong to **workspaces**.

| Table | Purpose |
|---|---|
| `plans` | id, name, price_inr, monthly_credits, razorpay_plan_id, features. The **only** source of prices |
| `subscriptions` | workspace_id, plan_id, razorpay_subscription_id, status, period_end |
| `payments` | workspace_id, razorpay_payment_id, razorpay_order_id, amount, currency, status (created, paid, failed, refunded), raw event |
| `webhook_events` | source, event_id (unique), received_at, processed_at; makes webhook handling idempotent |
| `credit_balances` / `credit_ledger` | Credits granted by `grant_credits(workspace_id, amount, payment_id)` |

Users can read their own workspace's rows. Only Edge Functions using the service role, and the credit functions, can write them.

## 5. Backend (Edge Functions)

### 5.1 `razorpay-create-subscription` (JWT required)
- **Input:** `{ planId }` only. The function ignores any user id, workspace id, amount or currency sent by the browser.
- It reads the user from the verified JWT and checks that they are the **owner** of the workspace (with AAL2 if MFA is enabled).
- It loads `razorpay_plan_id` from `plans`, creates the subscription and stores a `subscriptions` row with status `created`.
- **Returns:** `{ subscriptionId, keyId }`.

### 5.2 `razorpay-create-order` (JWT required)
- **Input:** `{ packId }`. The amount comes from the server-side pack configuration.
- It creates the order and stores a `payments` row with status `created`.
- **Returns:** `{ orderId, amount, currency, keyId }`.

### 5.3 `razorpay-webhook` (`verify_jwt = false`, signature required)
1. Read the **raw** body and verify `x-razorpay-signature` with `RAZORPAY_WEBHOOK_SECRET`. If verification fails, reject with 400 and grant nothing.
2. Insert `x-razorpay-event-id` into `webhook_events`. If it already exists, return 200 and do nothing.
3. Check the account, currency and amount against `plans` or the packs, and check the environment (test or live).
4. Handle the events:
   - `subscription.activated`: set status `active`.
   - `subscription.charged`: set status `active` and `period_end`, store the payment, `grant_credits(plan.monthly_credits)`.
   - `subscription.halted` / `subscription.cancelled`: set status; paid features stop at `period_end`.
   - `payment.captured` (order): mark the payment paid, grant the pack credits.
   - `payment.failed`: log it and mark it failed; grant nothing.
   - `refund.processed`: mark it refunded and add an `adjust` ledger entry.
5. Handle events that arrive out of order (for example `charged` before `activated`) by deciding the state from the event data, not from arrival order.
6. Return 200 once the event is stored.

### 5.4 No access-granting "verify" endpoint
Razorpay's browser success callback is **not trusted**. The front end may send the callback fields to an optional `razorpay-check-status` function, which only reports whether the webhook has already been processed. It never grants access.

## 6. Frontend

- **Load Checkout.js** from Razorpay's CDN inside a `useEffect`, only on pages that need it. Add its domains to the CSP.
- **`<PaymentButton planId>` / `<PackButton packId>`:**
  - On click, call the create function, then open Razorpay Checkout with the returned id.
  - On success, go to `/payment/success?ref=…`. That page shows "Confirming your payment…" and waits, through Realtime or polling, until the subscription or payment row is updated by the webhook. Then it shows what was unlocked and a "Go to dashboard" button.
  - On failure or dismissal, go to `/payment/failed` with a friendly message, a retry button and the support email link.
- **Pricing page:** shows the plans from the `plans` table (static copy in M1, live data in M7). Each plan's CTA starts the flow; signed-out users are sent to sign-up first.
- **Billing page `/app/billing`:** current plan, credit balance, invoices, cancel subscription.
- **Code comments:** plain English, so a non-technical founder can follow each block.

## 7. Webhook setup (when M7 is built)

- **URL:** `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook` (staging and production each have their own).
- **Where:** Razorpay Dashboard → Account & Settings → Webhooks → Add new webhook. Check the current navigation in the docs.
- **Events:** `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, `payment.captured`, `payment.failed`, `refund.processed`.
- **Secret:** set a strong webhook secret in the dashboard and store the same value as `RAZORPAY_WEBHOOK_SECRET`.

## 8. Testing

1. Use Razorpay test mode keys and the test cards and UPI IDs listed in Razorpay's docs.
2. **End to end:** Pricing → choose plan → Checkout (test) → success page shows "confirming" → webhook arrives → plan active and credits added once.
3. **Webhooks locally:** run `supabase functions serve` and expose it with a tunnel (ngrok or cloudflared), or use the dashboard's test-webhook feature.
4. **Negative tests (security.md Phase 20):**
   - An invalid signature is rejected.
   - Re-sending the same event does not double the credits.
   - A forged browser "success" grants nothing.
   - A changed `planId` price in the request is ignored.
   - A member who is not the owner cannot start a subscription.

## 9. Owner setup (test mode, before the first test payment)

1. Razorpay Dashboard in **Test mode** → Account & Settings → API keys → Generate. Type the Key Id and Key Secret into `supabase/.env` (local) after `RAZORPAY_KEY_ID=` and `RAZORPAY_KEY_SECRET=`. For staging, set them as Supabase secrets yourself (`npx supabase secrets set RAZORPAY_KEY_ID=… RAZORPAY_KEY_SECRET=…`). Never paste them into chat.
2. Subscriptions → Plans → create three **monthly** plans for exactly ₹399, ₹899 and ₹1,999. The webhook refuses any other amount.
3. Copy each plan id (`plan_…`) into the `plans` table (`razorpay_plan_id` for starter, growth, agency). A plan without one shows "cannot be bought yet".
4. Webhooks → Add: URL `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`, the events in section 7, and a strong secret. Store the same secret as `RAZORPAY_WEBHOOK_SECRET` (staging gets its own; Razorpay refuses localhost URLs, so local webhooks are tested with signed events from a script or through a tunnel).
5. Pay with Razorpay's test UPI id or test card, then check: the "Confirming your payment" page turns to "confirmed", credits are added once, and the export has no watermark.

## 10. Go-live checklist

- [ ] Live keys and live webhook secret set only in production secrets
- [ ] Webhook URL points to the production project (HTTPS)
- [ ] Legal pages live, with real business name, support email, phone and city
- [ ] GSTIN added in Razorpay for GST invoices
- [ ] Real ₹1 transaction: webhook received, credits granted once, refund processed
- [ ] Razorpay and Supabase dashboard MFA enabled for all admins
