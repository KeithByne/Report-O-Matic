## Report-O-Matic (SaaS) — build from zero (Windows)

This folder is your **repo** (repository): the project folder that contains all the code/config needed to build and deploy the SaaS.

### What you will build (high level)
- **Web app**: Next.js hosted on Vercel (`report-o-matic.online`)
- **Database/Auth/Storage**: Supabase (multi-tenant with Row Level Security)
- **Payments**: Stripe Checkout (credit packs) + Stripe Connect (affiliate/agent payouts)
- **AI**: OpenAI API (server-side only)
- **PDF**: server-side generation; PDFs stored securely and downloaded via signed links

### Folder map (what goes where)
- `app/`: the Next.js SaaS (UI + server routes like Stripe webhook, OpenAI calls, PDF generation)
- `supabase/`: SQL migrations (tables + RLS policies)
- `public-pages/`: standalone `.html` pages (single-file HTML + JS), if you need them

### Step 0 — prerequisites (install once)
1. Install **Node.js LTS** (for running the app locally).
2. Install **Git** (optional but strongly recommended for backups and deployment).

### Step 1 — create the Next.js app (local)
Open PowerShell in this folder and run:

```powershell
cd "c:\Users\keith\Desktop\REPORT-O-MATIC\report-o-matic-saas"
cd app
npm create next-app@latest .
```

When prompted, choose:
- TypeScript: **Yes**
- ESLint: **Yes**
- App Router: **Yes**
- Tailwind: **Yes** (recommended)

Then run:

```powershell
npm run dev
```

You should see the app at `http://localhost:3000`.

**Landing / sign-in page (local):** with the dev server running, open **`http://localhost:3000/landing.html`** (same origin as the API). Do **not** rely on double-clicking the HTML file from disk (`file://`) — browsers often block those requests (“Failed to fetch”).

### Step 1.5 — enable real OTP emails (Resend)
Right now in local dev, codes can appear in the server log. To send real emails:

1. Create a free Resend account (or use your existing one).
2. Verify your domain `report-o-matic.online` in Resend (recommended), then create a sender like `no-reply@report-o-matic.online`.
3. In `app/`, create a file named `.env.local` (do not commit it), with:

```env
RESEND_API_KEY=re_...
ROM_FROM_EMAIL=no-reply@report-o-matic.online
ROM_OTP_PEPPER=dev-change-me
ROM_SESSION_SECRET=dev-change-me-too
```

4. Restart the dev server (`npm run dev`).
5. Request a code again — it should arrive by email.

### Step 2 — Supabase project + database tables
1. In [Supabase](https://supabase.com), create a new project for Report-O-Matic.
2. Open **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never put this in client code)
3. Open **SQL Editor** and run each file below **in order** (one paste + **Run** per file). If a migration was already applied, re-running is usually safe only when the file uses `if not exists` / idempotent patterns—when unsure, check the table/column list in the Dashboard first.

   | Order | File |
   |------|------|
   | 1 | `supabase/migrations/0001_init.sql` |
   | 2 | `0002_otp_signup_metadata.sql` |
   | 3 | `0003_students_reports.sql` |
   | 4 | `0004_classes_language_report_inputs.sql` |
   | 5 | `0005_class_fields_student_identity.sql` |
   | 6 | `0006_classes_assigned_teacher_email.sql` |
   | 7 | `0007_reports_teacher_preview.sql` |
   | 8 | `0008_students_class_cascade.sql` |
   | 9 | `0009_class_scholastic_archives.sql` |
   | 10 | `0010_tenant_pdf_letterhead.sql` |
   | 11 | `0011_tenant_letterhead_logo.sql` |

   **Deploy order:** apply the same migrations to the **production** Supabase project **before** or **with** your first Vercel deploy that expects those columns—Vercel does not run SQL migrations for you.
4. Add to `app/.env.local`:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

5. Restart `npm run dev`.

**Behavior:** If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, OTP challenges are stored in Postgres. If not, the app falls back to the in-memory dev store (and may log codes to the terminal when Resend is not configured).

### Step 3 — create your Stripe objects (hosted)
In Stripe:
1. Create Products/Prices for your 5 packs.
2. Enable **Stripe Connect** and choose **Express** onboarding (recommended).
3. Configure payout rule: **Agents must complete onboarding before payouts**.

### Step 4 — deploy to Vercel

The Next.js app lives in **`app/`**. Vercel must use that folder as the **root** of the deployment (so builds run where `package.json` is).

#### 4a — Put the project on Git (recommended)

Vercel connects to **GitHub / GitLab / Bitbucket**. If this folder is not a Git repo yet:

```powershell
cd "c:\Users\keith\Desktop\REPORT-O-MATIC\report-o-matic-saas"
git init
git add .
git commit -m "Initial Report-O-Matic SaaS"
```

Create an empty repository on GitHub, add it as `origin`, then `git push -u origin main` (or `master`).  
If your Git repo is only the inner `app` folder, you can push that alone; if the repo is `report-o-matic-saas` or the whole desktop folder, use **Root Directory** below.

#### 4b — Create the Vercel project

1. Go to [vercel.com](https://vercel.com) → **Add New…** → **Project** → **Import** your Git repository.
2. **Root Directory**: set to the folder that contains this `package.json`:
   - Repo is only `app` → leave **Root Directory** empty or `.`
   - Repo is `report-o-matic-saas` → set **`app`**
   - Repo is the whole `REPORT-O-MATIC` tree → set **`report-o-matic-saas/app`**
3. **Framework Preset**: **Next.js** (not “Other”). If Vercel shows “Production overrides differ” or deployments stay stuck on an old commit, this setting was wrong — fix it and deploy **`main`** again. **Build Command** `npm run build`, **Output** default.
4. **Environment Variables** (Production — and Preview if you want previews to work with real APIs):

   | Name | Notes |
   |------|--------|
   | `ROM_OTP_PEPPER` | Long random string; **do not reuse** your local dev value in production. |
   | `ROM_SESSION_SECRET` | Long random secret; **new value** for production. |
   | `RESEND_API_KEY` | From Resend dashboard. |
   | `ROM_FROM_EMAIL` | Verified sender, e.g. `no-reply@report-o-matic.online`. |
   | `SUPABASE_URL` | Supabase → Settings → API → Project URL. |
   | `SUPABASE_SERVICE_ROLE_KEY` | **service_role** secret (server-only). |

   Copy from `app/.env.local` as a checklist, but **generate new** peppers/secrets for production.

5. Click **Deploy**. Fix any build errors shown in the log (run `npm run build` locally inside `app/` to reproduce).

#### 4c — Custom domain (`report-o-matic.online`)

1. In the Vercel project → **Settings** → **Domains** → add **`report-o-matic.online`** (and **`www.report-o-matic.online`** if you want).
2. Vercel will show the **DNS records** to add at your registrar (Namecheap, etc.):
   - Often an **A** record for `@` to Vercel’s IP, or **CNAME** for `www` to `cname.vercel-dns.com` — **use exactly what Vercel displays** (values can change).
3. Save DNS at the registrar and wait for propagation (minutes to a few hours). SSL is issued automatically once DNS is correct.

#### 4d — Verify production

- Open **`https://report-o-matic.online/landing.html`** (or your assigned `*.vercel.app` URL first).
- Test **Send security code** — Resend must accept your domain/sender in production.

#### 4e — Deploy without Git (optional)

From `app/`:

```powershell
npm i -g vercel
cd "c:\Users\keith\Desktop\REPORT-O-MATIC\report-o-matic-saas\app"
vercel
```

Link to a Vercel account, set env vars when prompted or in the dashboard. Git-based deploys are still recommended for ongoing updates.

### Stripe Connect anti-fraud defaults (recommended)
You will implement these in the app:
- Only create affiliate earnings from verified Stripe webhooks
- Keep earnings in **pending** state for a hold window (e.g. 14 days)
- Auto-reverse earnings on refunds/disputes
- Only allow payouts to agents whose Connect account is fully onboarded

