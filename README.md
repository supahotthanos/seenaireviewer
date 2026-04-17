# SeenAI Reviews

Multi-tenant review funnel. QR / SMS / email → star rating →
**4-5 stars**: AI-generated Google review + clipboard + Google redirect.
**1-3 stars**: private feedback form → email alert to the business owner.

## Ship it

See [`SHIP.md`](SHIP.md) — 15-minute setup, start to finish.

## Quick commands

```bash
npm run gen-secret    # generate a strong ADMIN_SECRET
npm run doctor        # check env vars before building
npm run dev           # local server on :3000
npm run build         # production build
```

## Check deployment health

Open `https://YOUR-DOMAIN/api/health` — JSON tells you exactly which env var
or DB call is broken. If `ok: true`, you're live.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + RLS) ·
Anthropic Claude · Resend · Upstash Redis.

## Structure

```
app/
  (public)/[clientSlug]/   public review funnel by slug
  admin/                   admin dashboard (gated by middleware)
  q/[shortCode]/           QR redirect + scan tracking
  api/
    generate-review/       POST — 4-layer rate-limited AI review
    submit-feedback/       POST — negative feedback + email alert
    reviews/[reviewId]/    PATCH — track copy / Google redirect
    admin/                 GET/POST/PATCH — clients, reviews, QR gen
    health/                GET — env + DB readiness probe
lib/
  env.ts                   required/optional env validation
  admin-auth.ts            timing-safe admin secret check
  supabase-server.ts       service-role client (server only, lazy)
  anthropic.ts             review generation prompt
  rate-limit.ts            per-IP + per-client + global caps
  email.ts                 Resend integration
  validation.ts            Zod schemas (single source of truth for input types)
  types.ts                 DB row types
supabase/
  setup.sql                idempotent, one-shot DB setup
  seed.example.sql         optional — SQL bulk-insert example
middleware.ts              gates /admin, enforces CORS
```
