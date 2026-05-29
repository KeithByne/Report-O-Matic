# Report-O-Matic — project state (handoff)

**Last updated:** 2026-05-27  
**Maintainer note:** Operator resting; **Wise Business deferred** until £50 available for Advanced plan.

Read this file at the start of infrastructure, billing, or go-live work. Details: `docs/PADDLE_SETUP.md`, `docs/OPERATIONS.md`, `docs/EMAIL_SETUP.md`.

---

## Live stack

| Piece | Status |
|-------|--------|
| App | Vercel → `https://report-o-matic.online` (GitHub `KeithByne/Report-O-Matic`, branch `main`) |
| Database | Supabase — run migrations in `supabase/migrations/` in order |
| Outbound email | Resend from `security@report-o-matic.online` |
| Inbound email | Namecheap Private Email → `support@`, `privacy@`, `admin@` |
| Sign-in | Password + Cloudflare Turnstile |
| Customer payments | **Paddle** (code ready; **not enabled** on production yet) |
| Operator payouts | **Wise Business Advanced** (not opened yet — blocked on £50 one-time fee) |

---

## What is done (code + docs)

- Paddle checkout API, webhook (`/api/paddle/webhook`), GBP pack pricing, billing success page
- Legal pages reference Paddle; subprocessors list Paddle + Wise
- Checkout returns to `/reports/{tenantId}/billing/success`
- SaaS health check requires Paddle secrets when `ROM_PADDLE_ENABLED=true`
- Weekend go-live checklist in `docs/PADDLE_SETUP.md`
- Branded email on site and in Vercel env
- Last pushed commit: **Paddle go-live prep** (`e9f681e` area — verify with `git log -1`)

---

## What is NOT done (operator tasks)

### Blocked now

- **Wise Business Advanced (£50 one-time)** — Essential (free) cannot receive GBP account details. Needed for Paddle monthly payouts. Operator will open when funds available.

### Still to do (when ready)

1. **Wise** — Advanced plan → copy GBP sort code + account number
2. **Supabase production** — confirm migrations `0046`, `0047`, `0048` applied; verify `credit_packs` GBP prices
3. **Paddle** — seller verification, domain approval, GBP catalog `pri_…` ids, webhook to `https://report-o-matic.online/api/paddle/webhook`
4. **Vercel (sandbox first)** — `ROM_PADDLE_ENABLED=true`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_ENVIRONMENT=sandbox`, redeploy
5. **Test purchase** — owner → Tester £5 → webhook → credits
6. **Production** — live Paddle keys, link Wise in Paddle Payouts, `PADDLE_ENVIRONMENT=production`

---

## Current customer-facing behaviour

- **Checkout is paused** until `ROM_PADDLE_ENABLED=true` in Vercel
- Billing page shows “Card checkout paused” for owners
- PDF export works; watermarked when credits = 0

---

## Wise vs Paddle (do not confuse)

- **Paddle** — customers pay on the site (Merchant of Record). Configured in Paddle dashboard + Vercel env.
- **Wise** — operator bank account for **receiving Paddle payouts**. Not in app code. Requires **Advanced** (£50) for GBP receive details.

---

## Optional later

- `ROM_PUBLIC_SCHOOL_SIGNUP=true` if open self-serve school signup is desired
- Paddle.js overlay checkout (hosted redirect works today)
- TOTP for owner accounts (discussed, not implemented)

---

## Quick prompts for next session

> Continue Report-O-Matic go-live: read `docs/PROJECT_STATE.md`. Wise is deferred (£50). Next step when ready: Wise Advanced → Paddle sandbox → Vercel env → test purchase. Checkout still off until `ROM_PADDLE_ENABLED=true`.
