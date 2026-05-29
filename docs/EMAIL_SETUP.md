# Report-O-Matic — branded email setup

Use this when moving off a personal address on the public site to `@report-o-matic.online`.

**Outbound** (login codes, invites, low-credit warnings) → **Resend** (already verified for `report-o-matic.online`).  
**Inbound** (customers reply, contact page) → **Namecheap Private Email** mailbox (or forwarding later).

---

## Addresses (recommended)

| Role | Address | Where it is used |
|------|---------|------------------|
| **Inbox you read** | `support@report-o-matic.online` | Contact page, refunds, billing questions |
| **Privacy / data** | `privacy@report-o-matic.online` | Privacy notice, DPA (can alias → same inbox) |
| **Automated sender** | `security@report-o-matic.online` | Resend **From** for OTP and system mail |
| **Reply-To** | `support@report-o-matic.online` | When users hit Reply on automated emails |

Your **personal email stays off the website**. You can still sign in to the SaaS owner dashboard with your own login email (`ROM_SAAS_OWNER_EMAILS` — not shown on the site).

---

## Part A — Namecheap mailbox (inbox access)

Do this in **Namecheap** (registrar for `report-o-matic.online`):

1. **Domain List** → **report-o-matic.online** → **Manage**.
2. Open **Private Email** (or **Email** → Private Email).
3. Subscribe / activate Private Email for this domain if not already (paid add-on on Namecheap).
4. Create mailbox **`support`** → full address `support@report-o-matic.online` with a strong password.
5. Optional: add **alias** `privacy@report-o-matic.online` → delivers to `support@` (one inbox for both).
6. Open webmail from Namecheap (**Mail** / **Webmail**) or add the account to Outlook/Apple Mail:
   - Server details: use the hostnames Namecheap shows (often `mail.privateemail.com`).

**Later (optional):** Namecheap → forward `support@` to your personal inbox — site still shows only `@report-o-matic.online`.

---

## Part B — Vercel (production env)

**Vercel** → Report-O-Matic project → **Settings** → **Environment Variables** → **Production**.

Set or update:

```env
RESEND_API_KEY=re_xxxxxxxx
ROM_FROM_EMAIL=security@report-o-matic.online
ROM_FROM_DISPLAY_NAME=Report-O-Matic
ROM_REPLY_TO_EMAIL=support@report-o-matic.online
ROM_SUPPORT_EMAIL=support@report-o-matic.online
ROM_PRIVACY_CONTACT_EMAIL=privacy@report-o-matic.online
```

Rules:

- `ROM_FROM_EMAIL` = **plain address only** (no angle brackets).
- Domain must stay **Verified** in Resend.

**Redeploy** production after saving.

The repo defaults in `app/src/lib/legal/operatorIdentity.ts` now use `@report-o-matic.online` if env vars are missing (e.g. local dev).

---

## Part C — Quick tests (after deploy)

1. **Contact page** — `https://report-o-matic.online/legal/contact` shows `support@…` / `privacy@…`, not Hotmail.
2. **Sign-in code** — request OTP; email **From** should be Report-O-Matic / `security@report-o-matic.online`.
3. **Reply** — reply to that email; message should arrive in **support@** webmail (or alias inbox).
4. **Resend → Logs** — confirms outbound sends; not an inbox.

---

## What already runs through Resend (no inbox needed)

These are **sent only**; you do not read them in an inbox unless someone replies:

- Sign-in / verify codes  
- Member invites  
- Low-credit warning emails  
- Inactive-account reminders (if enabled)

All use `ROM_FROM_EMAIL` + Resend API.

---

## Paddle / legal

Update **Paddle** seller contact to `support@report-o-matic.online` when convenient.

---

## Troubleshooting

| Problem | Check |
|---------|--------|
| Site still shows Hotmail | Vercel env not set or not redeployed; hard-refresh |
| OTP not arriving | Resend Logs; `RESEND_API_KEY`; domain verified |
| Reply bounces | Mailbox not created yet; or MX records missing in Namecheap Advanced DNS (Private Email wizard usually adds them) |
| privacy@ bounces | Create alias or separate mailbox; or set `ROM_PRIVACY_CONTACT_EMAIL=support@report-o-matic.online` |

See also: `docs/OPERATIONS.md`.
