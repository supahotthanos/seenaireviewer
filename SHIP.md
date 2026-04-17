# Ship It — 15 Minute Guide

Copy/paste checklist. End-to-end: zero → live review funnel.

---

## 0. Generate an admin secret (10 sec)

```bash
npm run gen-secret
```

Copy the string it prints. You'll paste it into `ADMIN_SECRET` below.

---

## 1. Create accounts (5 min)

Create these in parallel tabs — grab the keys into a scratchpad:

| Service | URL | What to grab |
|---|---|---|
| Supabase | https://supabase.com → New project (region: **East US**) | Project URL, anon key, **service_role** key (Settings → API) |
| Anthropic | https://console.anthropic.com | API key (starts `sk-ant-`) |
| Resend | https://resend.com | API key (starts `re_`). Domain verification optional for testing |
| Upstash | https://upstash.com → Create Database (Regional, us-east-1) | REST URL + REST token |

---

## 2. Set up the database (30 sec)

Supabase dashboard → **SQL Editor** → **New query** →
paste [supabase/setup.sql](supabase/setup.sql) → **Run**.

That's it. One file, idempotent — safe to re-run later.

---

## 3. Fill `.env.local` (2 min)

```bash
cp .env.local.example .env.local
```

Open `.env.local` and paste the keys from step 1. Set `ADMIN_SECRET` to the
string from step 0.

Then sanity-check:

```bash
npm run doctor
```

Every required key should show `✓`. Fix any `✗` before moving on.

---

## 4. Run locally (30 sec)

```bash
npm install
npm run dev
```

- Landing page: http://localhost:3000
- Health check: http://localhost:3000/api/health (should return `{ "ok": true }`)
- Admin: http://localhost:3000/admin?key=YOUR_ADMIN_SECRET

If `/api/health` shows anything other than `ok: true`, the JSON body tells
you exactly which env var or which DB call is broken. Fix that first.

---

## 5. Deploy to Vercel (3 min)

1. Push this repo to GitHub.
2. https://vercel.com → **Add New → Project** → import the repo.
3. Framework auto-detects **Next.js**. Expand **Environment Variables** and
   paste every key from `.env.local` (do NOT check `NEXT_PUBLIC_APP_URL`
   into git — set it to your Vercel URL for now, e.g.
   `https://YOUR-PROJECT.vercel.app`).
4. **Deploy**. Wait ~90 sec.
5. Open `https://YOUR-PROJECT.vercel.app/api/health` — should return
   `{ "ok": true }`.

---

## 6. Custom domain (2 min)

1. Vercel project → **Settings → Domains** → add `reviews.seenai.com`.
2. Copy the CNAME Vercel gives you → add it at your DNS provider.
3. Once green, **Settings → Environment Variables** → update
   `NEXT_PUBLIC_APP_URL` to `https://reviews.seenai.com` → **Redeploy**.

---

## 7. Create your first location (60 sec)

Open `https://reviews.seenai.com/admin?key=YOUR_ADMIN_SECRET`
→ click **+ New Location** → fill the form → **Create Location**.

You now have a live review funnel at `https://reviews.seenai.com/<slug>`.

---

## Ongoing: add locations + brands

The admin dashboard handles three onboarding flows — no code, no SQL.

### New brand (first location of a med spa)
1. Admin → **+ New Location**
2. Fill: business name, city, Google Place ID, notification email, services, team, optional colors + logo
3. **Create Location** → share the live URL

### Second+ location for the same brand (30 sec)
1. Admin → click **+ Clone** on the card of the first location
   *(or on the detail panel, click **Clone**)*
2. The form opens pre-filled with brand fields — business name, services,
   team, colors, logo, notification email, daily AI limit
3. Only enter what's unique to the new location: **city, address, Google Place ID**
4. **Create Location**

### Edit an existing location
1. Click the location → **Edit** on the detail panel
2. Change anything you need. Slug is locked (existing QR codes + SMS links
   depend on it). You can also toggle **Active** off to disable a location
   without deleting it.
3. **Save Changes**

Then: select the client → **QR Codes** tab → generate + print QRs → share the URL.

---

## Troubleshooting

Open `/api/health` first. The JSON tells you what's wrong.

| Symptom | Fix |
|---|---|
| `/api/health` → `ok: false` with `env: ... MISSING` | Add the var in Vercel → redeploy |
| Admin page returns 404 | `ADMIN_SECRET` is missing, still the placeholder, or under 24 chars |
| "Wrong location's Google page" on Post to Google | `google_place_id` on that client is wrong — edit in admin |
| Negative email not arriving | Check Resend → Logs. If using `onboarding@resend.dev`, some inboxes block it — verify your domain in Resend |
| Rate limit during testing | Remove `UPSTASH_REDIS_REST_URL` in Vercel + redeploy (limits go off) |

---

## Environment variable cheat sheet

All listed in [`.env.local.example`](.env.local.example). Required:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_SECRET` (24+ chars; use `npm run gen-secret`)

Optional:

- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — omit to disable rate limits in dev
- `RESEND_FROM_EMAIL` — defaults to Resend's test sender
- `ANTHROPIC_MODEL` — defaults to `claude-sonnet-4-5`
- `MAX_AI_REVIEWS_PER_MONTH` — global safety cap, default 5000
