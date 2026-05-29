# Report-O-Matic — operations reference

Living notes for hosting, DNS, and email. Update this when infrastructure changes so agents and maintainers do not guess.

**Last updated:** 2026-05-29

---

## Two separate products (do not mix stacks)

| | **Report-O-Matic** | **Universal English** |
|--|-------------------|------------------------|
| Domain | `report-o-matic.online` | `universal-english.com` |
| Registrar | Namecheap | Namecheap |
| App / website host | **Vercel** (Next.js in `app/`) | **cPanel** (traditional hosting) |
| DNS / CDN | **Namecheap DNS → Vercel** (domain is **not** a zone in the main Cloudflare account) | **Cloudflare** (zone in `Admin@universal-english.com` account) → origin on cPanel |
| Bot protection | Cloudflare **Turnstile** on `/landing.html` sign-in (Turnstile ≠ adding the domain to Cloudflare Domains) | None by default |
| Transactional email | **Resend** from `@report-o-matic.online` | cPanel / provider for `@universal-english.com` |
| Database | **Supabase** | (not part of this repo) |

---

## Report-O-Matic — where to manage what

### Vercel (app + production deploy)

- GitHub: `KeithByne/Report-O-Matic` → `main` deploys production.
- Public URL: `https://report-o-matic.online` (and `www` if configured).
- Cron: `app/vercel.json` → `/api/cron/account-housekeeping` daily 06:00 UTC (`CRON_SECRET` required).

### Namecheap (registrar + DNS for ROM)

- Domain list → **report-o-matic.online** → **Advanced DNS**
- Typical setup: records point to **Vercel** (A/CNAME or Vercel nameservers — confirm in Vercel → Project → Domains).
- **Resend** domain verification DNS records also live here (domain verified in Resend).

### Cloudflare (Turnstile only for ROM)

- Turnstile widget protects sign-in; keys in Vercel env (`TURNSTILE_SITE_KEY` / secret).
- **Do not assume** `report-o-matic.online` appears under Cloudflare → Domains; that list is for DNS zones (e.g. Universal English only).

### Resend (outbound email)

- Domain `report-o-matic.online`: **Verified** in Resend.
- Resend is **send-only**; there is no inbox in Resend.
- API keys: Resend dashboard → API keys (use a **Sending access** key for production).

### Receiving mail at `support@report-o-matic.online`

- Configure at **Namecheap** (Email forwarding or Private Email), or another mailbox provider.
- Forward to a private inbox if desired; the public site should show `support@…`, not a personal address.

### Vercel environment variables (production checklist)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database |
| `RESEND_API_KEY` | Send OTP, invites, low-credit mail |
| `ROM_FROM_EMAIL` | Plain sender, e.g. `security@report-o-matic.online` |
| `ROM_FROM_DISPLAY_NAME` | Optional, e.g. `Report-O-Matic` |
| `ROM_REPLY_TO_EMAIL` | Optional, e.g. `support@report-o-matic.online` |
| `ROM_SUPPORT_EMAIL`, `ROM_PRIVACY_CONTACT_EMAIL` | Shown on legal/contact pages |
| `ROM_PUBLIC_BASE_URL` | e.g. `https://report-o-matic.online` |
| `ROM_PADDLE_ENABLED`, `PADDLE_*` | Billing (when live) |
| `CRON_SECRET` | Cron route auth |
| Turnstile secrets | Sign-in human verification |

`ROM_FROM_EMAIL` must be a **plain address** (no `Name <email>` in that variable). See `app/src/lib/email/resendShared.ts`.

Override legal defaults via `ROM_OPERATOR_*` env vars; see `app/src/lib/legal/operatorIdentity.ts`.

### Supabase

- Run migrations in `supabase/migrations/` in order on the production project.
- Recent: `0046_owner_account_lifecycle.sql`, `0047_credit_packs_gbp_paddle.sql`, `0048_credit_packs_gbp_parity.sql`.

### Payments

- **Paddle** (not Stripe for new checkout). Setup: `docs/PADDLE_SETUP.md`.

---

## Universal English — where to manage what

- **cPanel**: site files, PHP, mailboxes, databases for `universal-english.com`.
- **Cloudflare**: DNS, proxy, SSL, security for `universal-english.com` (zone in the Universal English Cloudflare account).
- **Namecheap**: domain renewal; nameservers may point to Cloudflare.

Do not deploy Report-O-Matic to this cPanel account or share ROM Vercel/Supabase credentials with the UE stack.

---

## Legal / public contact (Report-O-Matic)

- Support and privacy contact addresses come from Vercel env (`ROM_SUPPORT_EMAIL`, `ROM_PRIVACY_CONTACT_EMAIL`).
- UK registered office: collapsed **UK company disclosure** at the bottom of `/legal/terms` only (not in the global footer).
- Site footer: link list only (Pricing + legal pages); no street addresses in the footer.

---

## Quick prompts for AI agents

Copy when starting infrastructure work:

> **ROM:** Namecheap registrar, Vercel host, Namecheap DNS to Vercel, Resend outbound `@report-o-matic.online`, Turnstile in Cloudflare (not a CF DNS zone). **UE:** Namecheap registrar, Cloudflare DNS, cPanel host — separate product, do not mix.
