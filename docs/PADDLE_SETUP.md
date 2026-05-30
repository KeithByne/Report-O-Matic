# Paddle checkout (Report-O-Matic)

## Weekend go-live checklist

Use this order: **sandbox first**, then **production** after one successful test purchase.

### Already in the codebase (no code work needed)

- Checkout API → Paddle hosted checkout → redirect back to `/reports/{schoolId}/billing/success`
- Webhook at `/api/paddle/webhook` on `transaction.completed` adds credits
- Legal pages, pricing, refund policy, and footer links reference Paddle
- GBP pack prices in DB after migrations `0047` + `0048`
- Checkout stays **disabled** until `ROM_PADDLE_ENABLED=true`

### 1. Wise (operator banking — not in app code)

1. Open a **Wise Business** account (GBP balance is fine for UK operator).
2. Complete identity verification.
3. Note your **GBP account details** (sort code + account number, or IBAN if Paddle asks).
4. You will paste these into **Paddle → Payouts** after Paddle seller verification — Wise is **not** wired into Report-O-Matic; it only receives money **from** Paddle.

### 2. Supabase (production)

Run migrations in order if not already applied:

- `0046_owner_account_lifecycle.sql`
- `0047_credit_packs_gbp_paddle.sql` (adds `paddle_price_id`, initial GBP prices)
- `0049_credit_packs_gbp_list_prices.sql` (£5 / £25 / £500 / £1,000 / £5,000)

Confirm in SQL editor:

```sql
select id, name, price_cents, currency, paddle_price_id, active
from credit_packs
order by sort_order;
```

### 3. Paddle seller account

1. Sign up at [paddle.com](https://www.paddle.com) → complete **seller verification** (business details, domain, product description: school report credit packs).
2. Submit **website / domain review** using the public URLs table below.
3. **Checkout → Checkout settings → Default payment link:**  
   `https://report-o-matic.online/reports`  
   (Per-checkout return URLs point to each school’s billing success page; this default is a Paddle requirement for hosted checkout links.)
4. Add **approved domains:** `report-o-matic.online` and `www.report-o-matic.online`.

### 4. Paddle catalog (recommended)

Create one **product** (“Report-O-Matic report credits”) and **GBP prices** matching:

| Pack id | Reports | Price |
|---------|---------|-------|
| `tester` | 50 | £5.00 |
| `economy` | 250 | £25.00 |
| `school` | 600 | £500.00 |
| `large_school` | 1,300 | £1,000.00 |
| `universal_school` | 6,000 | £5,000.00 |

Copy each `pri_…` into Supabase:

```sql
update credit_packs set paddle_price_id = 'pri_…' where id = 'school';
-- repeat per pack
```

Or set Vercel env `ROM_PADDLE_PRICE_SCHOOL=pri_…` etc. (DB column wins if both are set).

Without catalog IDs, sandbox still works using **dynamic line items** from `price_cents`.

### 5. Paddle webhook

**Developer tools → Notifications → New destination**

| Field | Value |
|-------|--------|
| URL | `https://report-o-matic.online/api/paddle/webhook` |
| Events | `transaction.completed` |

Copy the **notification secret** → Vercel `PADDLE_WEBHOOK_SECRET`.

### 6. Vercel env (start in **sandbox**)

| Variable | Sandbox example |
|----------|-------------------|
| `ROM_PADDLE_ENABLED` | `true` (only when ready to test checkout) |
| `PADDLE_API_KEY` | Sandbox API key from Paddle |
| `PADDLE_WEBHOOK_SECRET` | From notification destination |
| `PADDLE_ENVIRONMENT` | `sandbox` |
| `ROM_PUBLIC_BASE_URL` | `https://report-o-matic.online` |

Redeploy after changing env vars.

**SaaS owner health check:** `/api/saas-owner/security/health` flags missing Paddle secrets when `ROM_PADDLE_ENABLED=true` in production.

### 7. Sandbox test purchase

1. Sign in as a **school owner** with exhausted test credits (or non-test school).
2. Go to **Buy report credits** for that school.
3. Buy the **Tester** pack (£5) with Paddle test card.
4. Confirm redirect to **Payment received** page.
5. Confirm webhook in Paddle notification log (200 from your app).
6. Confirm **owner credit balance** increased in the app.

If credits lag by a few seconds, refresh — fulfillment is webhook-driven.

### 8. Production flip

1. Paddle: complete live seller approval; create **live** catalog prices (same GBP amounts).
2. Update `paddle_price_id` / env with **live** `pri_…` ids.
3. Vercel: swap to **live** `PADDLE_API_KEY`, live webhook secret, `PADDLE_ENVIRONMENT=production`.
4. Paddle **Payouts:** link **Wise** GBP account.
5. Keep `ROM_PADDLE_ENABLED=true`.
6. Optional: set `ROM_PUBLIC_SCHOOL_SIGNUP=true` if you want new schools to self-register without invite-only gating (see `publicSignupPolicy.ts`).

### 9. What customers see

- **Before enable:** billing page shows “Card checkout paused.”
- **After enable:** owner sees GBP packs → **Continue to payment** → Paddle checkout → success page → credits on account.

---

## Public URLs for Paddle domain / website review

| Page | URL |
|------|-----|
| Landing / sign-in | `/landing.html` |
| Pricing | `/pricing` |
| Terms & Conditions | `/legal/terms` |
| Privacy Policy | `/legal/privacy` |
| Refund & cancellation policy | `/legal/refund` |
| Contact | `/legal/contact` · `support@report-o-matic.online` |

Landing page **Pricing** and **Legal** menus open these pages in a **new browser tab** so sign-in stays open.

---

Report-O-Matic uses **Paddle Billing** as Merchant of Record (MoR): Paddle runs checkout, calculates VAT/sales tax, and sends `transaction.completed` webhooks. Pack list prices in the database are **GBP**, using the same numeric amounts as the legacy EUR packs (e.g. €25 → £25 — see `app/src/lib/finance/packPricing.ts`).

## Pack prices (GBP, after migration `0048`)

| Pack | Reports | Price |
|------|---------|-------|
| Tester | 50 | £5.00 |
| Economy | 250 | £25.00 |
| School | 600 | £500.00 |
| Large School | 1,300 | £1,000.00 |
| Universal School | 6,000 | £5,000.00 |

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ROM_PADDLE_ENABLED` | `true` to allow checkout and apply webhooks |
| `PADDLE_API_KEY` | Server API key (sandbox or live) |
| `PADDLE_WEBHOOK_SECRET` | Secret from Paddle → Developer tools → Notifications |
| `PADDLE_ENVIRONMENT` | `sandbox` (default) or `production` |
| `ROM_PUBLIC_BASE_URL` | e.g. `https://www.report-o-matic.online` |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Optional: for Paddle.js overlay checkout later |
| `ROM_PADDLE_PRICE_<PACK_ID>` | Optional catalog `pri_…` per pack (e.g. `ROM_PADDLE_PRICE_SCHOOL`) |

Disable Stripe for new checkouts: leave `ROM_STRIPE_ENABLED` unset. Legacy `/api/stripe/webhook` remains for historical events only.

## Paddle dashboard

1. Create a **product** and **prices** in GBP matching the table above (recommended).
2. Copy each `pri_…` into `credit_packs.paddle_price_id` or env `ROM_PADDLE_PRICE_*`.
3. **Notifications** → destination URL: `https://<host>/api/paddle/webhook`  
   Subscribe to **`transaction.completed`** (and optionally `transaction.paid`).
4. **Checkout settings** → set default payment link to `https://report-o-matic.online/reports` (required by Paddle; each checkout also sets a per-school return URL to `/reports/{tenantId}/billing/success`).

Without catalog price IDs, checkout creates a **one-off line item** from `price_cents` (still works in sandbox).

## Compatibility notes

- **Paddle.js / overlay checkout** (`Paddle.Checkout.open`) is supported by Paddle but not wired in the UI yet; the app uses **hosted checkout** via `transactions.create` + redirect to `checkout.url` (same flow Paddle documents for Pay Gate / Billing).
- **Tax**: Do not set `ROM_VAT_RATE_PERCENT` to add UK VAT on the billing page when Paddle is enabled — Paddle adds tax at checkout. Default display is **inclusive list price in GBP**.
- **Referrals**: Commission is still recorded on `transaction.completed` using `custom_data` from checkout.
- **Agent payouts**: Still use manual Stripe Connect IDs in the dashboard until a separate payout integration is added.

## Database

Run migrations: `0047_credit_packs_gbp_paddle.sql` (Paddle column), then `0048_credit_packs_gbp_parity.sql` (GBP list prices).
