# Paddle checkout (Report-O-Matic)

## Public URLs for Paddle domain / website review

| Page | URL |
|------|-----|
| Landing / sign-in | `/landing.html` |
| Pricing | `/pricing` |
| Terms & Conditions | `/legal/terms` |
| Privacy Policy | `/legal/privacy` |
| Refund & cancellation policy | `/legal/refund` |
| Contact | `/legal/contact` · `keith.byne@hotmail.co.uk` |

Landing page **Pricing** and **Legal** menus open these pages in a **new browser tab** so sign-in stays open.

---

Report-O-Matic uses **Paddle Billing** as Merchant of Record (MoR): Paddle runs checkout, calculates VAT/sales tax, and sends `transaction.completed` webhooks. Pack list prices in the database are **GBP**, using the same numeric amounts as the legacy EUR packs (e.g. €25 → £25 — see `app/src/lib/finance/packPricing.ts`).

## Pack prices (GBP, after migration `0048`)

| Pack | Reports | Price |
|------|---------|-------|
| Tester | 50 | £5.00 |
| Economy | 250 | £25.00 |
| School | 600 | £50.00 |
| Large School | 1,300 | £100.00 |
| Universal School | 6,000 | £500.00 |

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
4. **Checkout settings** → set default payment link to your app origin if using hosted checkout URLs.

Without catalog price IDs, checkout creates a **one-off line item** from `price_cents` (still works in sandbox).

## Compatibility notes

- **Paddle.js / overlay checkout** (`Paddle.Checkout.open`) is supported by Paddle but not wired in the UI yet; the app uses **hosted checkout** via `transactions.create` + redirect to `checkout.url` (same flow Paddle documents for Pay Gate / Billing).
- **Tax**: Do not set `ROM_VAT_RATE_PERCENT` to add UK VAT on the billing page when Paddle is enabled — Paddle adds tax at checkout. Default display is **inclusive list price in GBP**.
- **Referrals**: Commission is still recorded on `transaction.completed` using `custom_data` from checkout.
- **Agent payouts**: Still use manual Stripe Connect IDs in the dashboard until a separate payout integration is added.

## Database

Run migrations: `0047_credit_packs_gbp_paddle.sql` (Paddle column), then `0048_credit_packs_gbp_parity.sql` (GBP list prices).
