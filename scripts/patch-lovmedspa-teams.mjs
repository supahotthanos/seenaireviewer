#!/usr/bin/env node
// Patch each of the 5 LovMedSpa locations with its actual per-location
// providers + service list, sourced from each location's own /locations/<slug>
// page on lovmedspa.com.
//
// Run:  node scripts/patch-lovmedspa-teams.mjs

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ENV_PATH = resolve(process.cwd(), '.env.local')
if (existsSync(ENV_PATH)) {
  for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(k in process.env)) process.env[k] = v
  }
}

const ADMIN_SECRET = process.env.ADMIN_SECRET
if (!ADMIN_SECRET) { console.error('ADMIN_SECRET missing'); process.exit(1) }
const APP_URL = 'https://reviews.seenai.digital'

// Shared baseline services (offered at every location per their own pages)
const BASE_SERVICES = [
  'Botox', 'Dermal Filler', 'Lip Filler',
  'PRP', 'PRF', 'Sculptra', 'RADIESSE', 'Mesotherapy',
  'PDO Threads', 'Liquid BBL',
  'Weight Loss Injection', 'Sexual Health Treatment',
  'CO2 Laser', 'Aveli Cellulite', 'Rejuran',
  'HydraFacial', 'Morpheus8', 'Microneedling', 'Chemical Peel', 'Dermaplaning',
]

// Per-location overrides
const PATCHES = {
  'lovmedspa-brooklyn': {
    team_members: [
      'Dr. Ahmed Elsoury, MD (Medical Director)',
      'Riyeon Kim, MSN, RN, OCN',
      'Maytal Dayan, DNP, FNP-C',
      'Kaisha Jean-Louis, RN, BSN',
      'Kee Osawagara (Esthetician)',
    ],
    services: BASE_SERVICES,
  },
  'lovmedspa-manhattan': {
    team_members: [
      'Dr. Ahmed Elsoury, MD (Medical Director)',
      'Mohiba Rafiq, ACNP, RNFA',
      'Kee Osawagara (Esthetician)',
    ],
    services: BASE_SERVICES,
  },
  'lovmedspa-staten-island': {
    team_members: [
      'Dr. Ahmed Elsoury, MD (Medical Director)',
      'Krysta Murnane',
    ],
    // Staten Island's page explicitly names extra specialty services
    services: [
      ...BASE_SERVICES,
      'Xeomin', 'Non-Surgical Rhinoplasty', 'PRP Hair Loss',
      'Filler Dissolver', 'Non-Surgical Facelift', 'Fox Eye Thread Lift',
      'Semaglutide', 'Tirzepatide',
    ],
  },
  'lovmedspa-miami': {
    team_members: [
      'Mark Ennett, PhD, CRNA',
      'Andrea Herrera (Esthetician)',
    ],
    services: BASE_SERVICES,
  },
  'lovmedspa-west-farms': {
    team_members: [
      'Mark Ennett, PhD, CRNA',
      'Jocelyne Betun, BSN, RN, OCN',
      'Roslyn Forde-Tucker, MSN, FNP-C',
    ],
    services: BASE_SERVICES,
  },
}

// Get list of clients to map slug → id
const headers = {
  'Content-Type': 'application/json',
  'x-admin-secret': ADMIN_SECRET,
}

const listRes = await fetch(`${APP_URL}/api/admin/clients`, { headers })
if (!listRes.ok) { console.error('Failed to list clients:', listRes.status); process.exit(1) }
const { clients } = await listRes.json()
const bySlug = Object.fromEntries(clients.map(c => [c.slug, c]))

console.log(`\n  Patching team + services for ${Object.keys(PATCHES).length} locations\n`)

let ok = 0, fail = 0
for (const [slug, updates] of Object.entries(PATCHES)) {
  const client = bySlug[slug]
  if (!client) { console.log(`  ✗ ${slug}  — not found`); fail++; continue }

  const res = await fetch(`${APP_URL}/api/admin/clients`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ id: client.id, updates }),
  })
  if (res.ok) {
    console.log(`  ✓ ${slug.padEnd(26)} team=${updates.team_members.length}  services=${updates.services.length}`)
    ok++
  } else {
    const body = await res.json().catch(() => ({}))
    console.log(`  ✗ ${slug}  [${res.status}]  ${JSON.stringify(body)}`)
    fail++
  }
}

console.log(`\n  Patched: ${ok}   Failed: ${fail}\n`)
process.exit(fail ? 1 : 0)
