# Residential IP per-market scoping

**Status:** scoping only. No commitments yet. Decision needed before
expanding the AEO tester to multi-market monitoring.

## TL;DR

The existing AEO tester runs from Vercel `iad1` (Virginia). For grounded
LLM search calls, that means the search backend often sees a US-East IP
regardless of where the client is actually located. This document scopes
how to fix that — but **before reaching for residential proxies**, two
much cheaper interventions usually move 60-80% of the gap:

1. **Pass `user_location` explicitly** on OpenAI Responses + Anthropic
   Messages web search tools (both providers accept country/city/timezone
   hints).
2. **Inject the city in the prompt** ("you are searching from Brooklyn,
   NY"). We already do this in our paraphrase templates.

Residential proxies become worth scoping **only** for the residual
contamination — primarily Gemini grounded search, where Google does not
expose a user_location parameter and may use request-origin signals.

Recommendation at the end: run a **2-week pilot in one target metro**
before any proxy spend. Specific data to collect is listed in
[Decision criteria](#decision-criteria).

---

## What actually leaks geo into our results

| Layer | Geo signal | Mitigation |
|---|---|---|
| OpenAI Responses + `web_search_preview` | Search-side query inherits user_location param when set; otherwise OpenAI infra IP | `user_location: { country, city, region, timezone }` |
| Anthropic Messages + `web_search_20250305` | Brave search call also accepts user_location hints | `web_search.user_location` |
| Gemini + `google_search` grounding tool | Google grounded-search call uses request locale + likely the request-origin IP | **No user_location knob; proxy required** |
| Prompt content | Always | We prepend "best med spa in {city}" in 5 paraphrase templates |
| Our outbound IP (Vercel `iad1`) | Hits the LLM provider, not the search backend, on OpenAI/Anthropic | n/a (provider does the search server-side) |

The contamination story is **not** "every call gets US-East geolocation."
It's **"Gemini grounded results inherit Google's view of the request
origin, and OpenAI/Anthropic inherit our missing user_location signal."**

That distinction is load-bearing for the proxy economics below.

---

## Architecture options

### (a) Vercel Edge Functions in target region

- **Cost:** included in current Vercel plan; ~$0 incremental.
- **Granularity:** Vercel regions (`iad1`, `sfo1`, `lhr1`, `syd1`, …) are
  cloud-DC level. They give continent + rough country, not metro DMA.
  Brooklyn vs. Bronx is not separable; San Francisco vs. San Jose is not
  separable.
- **Verdict:** **useful for Phase 0 country-level testing only.** Will not
  satisfy a "test ranking in Phoenix vs Mesa" requirement.

### (b) Self-hosted egress proxy per market with vendor IPs

- One small VPS (DigitalOcean / Hetzner ~$5-10/mo) per target metro.
- Configure HTTPS proxy (e.g. tinyproxy/3proxy) that rotates through
  vendor IPs allocated for that metro.
- Our app routes outbound provider calls through the per-market proxy via
  `HTTPS_PROXY` env var or a custom Node `httpsAgent`.
- **Pros:** Full control, IP stickiness configurable per-session, debug
  visibility, single place to swap vendors.
- **Cons:** Operational overhead (10 VPS to monitor, certs to manage,
  proxy software to patch), vendor lock-in is per-market.

### (c) Per-call proxy injection at fetch level

- Inject a vendor-provided proxy URL (e.g. BrightData super-proxy) into
  every `fetch` from our Vercel function.
- **Blocker:** OpenAI / Anthropic API endpoints do not honor `Forwarded`
  or `X-Forwarded-For`. The proxy must be the **actual TCP egress** —
  there is no "fake my IP via header" path. So this collapses into the
  same architecture as (b), just with the proxy hosted by the vendor
  instead of us.
- **Pros vs. (b):** No VPS to run.
- **Cons vs. (b):** Per-GB billing instead of per-IP-hour; less control;
  vendor's proxy uptime becomes our SLO floor.

### Recommendation

**(c) for the pilot, (b) only if the pilot demonstrates worthwhile geo
delta.** The reason: the pilot is small (~600 calls/day in one market,
~0.1 GB/mo), well under the per-GB break-even where (b) wins. If we go
multi-market full production, revisit (b).

---

## Vendor comparison

Prices are list rates as of Q1 2026 — actual quotes typically come in
10-30% lower for committed monthly plans. All five vendors expose US
metro DMA targeting on residential plans; ISP-grade IPs are a separate
SKU on most.

| Vendor | $/GB list | 5GB tier | 50GB tier | 250GB tier | Geo granularity | IP type | Pricing model | API quality |
|---|---|---|---|---|---|---|---|---|
| **BrightData** | ~$8.40 | $42 | ~$420 | ~$1,500 | US metro DMA + zip | residential / ISP / DC | per-GB + super-proxy | best — full REST + dashboards + per-session sticky IPs |
| **Oxylabs** | ~$8.00 | $40 | ~$300 (vol disc.) | ~$1,250 | US metro DMA | residential / ISP | per-GB | strong — REST + dashboards |
| **Decodo (formerly Smartproxy)** | ~$6.00 | $30 | ~$200 | ~$700 | country + US state, limited DMA | residential / DC | per-GB | good — REST, simpler |
| **IPRoyal** | ~$3.50 | $17 | ~$150 | ~$650 | country + state | residential | per-GB or per-IP-hour | basic — REST + simple control panel |
| **NetNut** | ~$10-12 | $50 | ~$500 | ~$2,000 | metro on ISP plan | **ISP-grade (most stable)** | per-GB | strong — REST + sticky session APIs |

**For our use case** (low-bandwidth API proxying, metro-level geo
required for medical/local search testing), the ranking is:

1. **BrightData** — best metro DMA targeting; expensive but the
   granularity matters. The whole point of this exercise is metro-level
   accuracy.
2. **Oxylabs** — close second; cheaper at scale; metro DMA available.
3. **NetNut** — pricier per GB but ISP-grade IPs reduce flakiness;
   worth it ONLY if we see consistent timeout/CAPTCHA issues with
   residential pools.
4. **Decodo, IPRoyal** — viable for country-level only; if we don't
   actually need DMA-level geo, these halve the bill.

---

## Cost model

Assumed steady-state load: **5 paraphrases × 5 trials × 24 models = 600
calls/day per market**, 10 target markets = 6,000 calls/day = **180,000
calls/month**.

Bytes per call ≈ 5 KB request + 5 KB response = ~10 KB.
Total monthly egress through proxy ≈ 180,000 × 10 KB ≈ **1.8 GB/month
across all markets**, or ~0.18 GB/market/month.

That's tiny. The vendor minimum tiers and per-IP-hour pricing dominate
over actual bandwidth.

| Vendor | List monthly | Effective monthly | Notes |
|---|---|---|---|
| BrightData (5 GB tier) | $42 | $42 | Plenty of headroom for 1.8 GB |
| BrightData (50 GB tier) | $420 | $420 | Only worth it if we 25× the volume |
| Oxylabs (5 GB) | $40 | $40 | Same; pilot fits under min tier |
| Decodo | $30 | $30 | Pilot-friendly |
| Self-hosted (b) | ~$50-100 | ~$70 ops + ~$30 IPs | 10 × $5 VPS + ~$30 IP allocation |

**Pilot ($/month for 1 market):** ~$30-50.
**Steady state ($/month for 10 markets, residential pool):** ~$50-100
on the cheapest entry-tier plan; ~$200-400 if metro DMA targeting needs
the BrightData or Oxylabs higher tiers.

Compare to expected client revenue: if SeenAI charges $200-500/mo per
medspa and we monitor 10 markets, the proxy line item is 1-3% of MRR —
absolutely affordable IF the geo delta is real and material.

---

## Phased rollout

### Phase 0 — week 1: prove the premise without proxies (no spend)

Before paying anything, confirm the geolocation hypothesis:

1. Wire `user_location` on OpenAI Responses + Anthropic Messages web
   search tools (these knobs already exist; we just don't pass them).
2. Compare the new `user_location`-anchored runs against current
   Virginia-default runs across **2 representative markets**: NYC
   (where current Vercel iad1 is "close") and Phoenix (where it is far).
3. Measure mention-rate delta and citation-domain delta. If `user_location`
   alone closes 60-80% of the gap, **cancel the proxy project** and ship
   user_location everywhere.

### Phase 1 — weeks 2-3: 1-market proxy pilot

If Phase 0 leaves a meaningful residual gap (especially on Gemini):

1. Pick **1 pilot metro** with the largest residual delta (probably
   Phoenix or another non-East-Coast metro).
2. Sign up for **BrightData $42 entry tier** (lowest commitment with
   metro DMA support).
3. Wire `HTTPS_PROXY` or per-call `httpsAgent` for ALL outbound calls in
   the pilot market only.
4. Run a daily batch (600 calls) for 14 days.
5. Capture per-day mention rate, mean rank, citation domain breakdown,
   and compare against Virginia baseline for the same paraphrases on
   the same days.

### Phase 2 — week 4: go/no-go decision

See [Decision criteria](#decision-criteria).

### Phase 3 — month 2+: scale-out (only if Phase 2 says go)

- Move to BrightData 50GB tier ($420/mo) or equivalent.
- Implement architecture (b) — self-hosted per-market egress proxies — to
  reduce per-GB cost as volume grows.
- Add per-market dashboards in the AEO tester (existing City filter
  already supports this; we'd just need to tag history entries with the
  proxy market they ran from).

---

## Decision criteria

The pilot is worth scaling out **if and only if** we see all three:

1. **Mention rate delta ≥ 10 percentage points** for the pilot market vs.
   Virginia baseline on the same days, sustained across 14 days. Less than
   that and we're inside the natural prompt-paraphrase noise floor.
2. **Citation domain mix differs materially** — at least 3 distinct
   domains in the pilot's top-10 that are NOT in Virginia's top-10.
   Local-source diversification is the actual product story for clients.
3. **Cost per actionable signal ≤ 5% of per-client MRR.** If we'd need to
   charge clients more to absorb the proxy cost, the answer is no.

If only 1 or 2 of those conditions hold:

- **Mention delta only:** consider proxies for one metric, but reconsider
  whether prompt engineering achieves the same.
- **Citation diversity only:** probably not worth it — the client buys
  ranking, not citation diversity.
- **Cost OK only:** the geo signal isn't real yet; revisit after we have
  more LLM models or providers.

---

## Open risks / known unknowns

- **CAPTCHAs and rate-limits on residential pools.** Brave search (used
  by Anthropic) and Bing (used by OpenAI) sometimes flag residential
  pools more aggressively than ISP/data-center IPs. Budget extra time
  in the pilot for retry handling.
- **Provider TLS certificate pinning.** If OpenAI or Anthropic ever
  enable cert pinning client-side (none do today server-to-server, but
  it's a generic risk), our proxy chain breaks.
- **Vendor IP overlap with abuse blocklists.** Cheap residential pools
  recycle IPs aggressively; getting flagged by Cloudflare-fronted
  providers can produce silent corruption (slightly different responses,
  not outright errors). Catchable only via the AEO tester's existing
  snapshot/fingerprint drift alerts plus visual spot-checks.
- **Anthropic's web_search user_location coverage.** API field exists
  but the coverage of cities is documented for a finite list. Pre-flight
  test before assuming it works for our target metros.

---

## Recommendation

**Do not spend on proxies yet.** Run Phase 0 first — it costs nothing,
takes a week, and likely closes most of the gap. Only proceed if the
residual gap (Gemini-anchored or otherwise) survives that intervention.

If we do proceed: BrightData $42/mo single-market pilot is the obvious
entry point. The pilot's go/no-go is a clear quantitative bar — see
[Decision criteria](#decision-criteria) — and the downside is one
month's $42 charge if the answer is "no, geo doesn't matter as much as
we thought."
