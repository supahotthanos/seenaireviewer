#!/usr/bin/env node
// One-shot seed — creates the 5 LovMedSpa locations via the admin API.
// Run:  node scripts/seed-lovmedspa.mjs
//
// - Reads ADMIN_SECRET from .env.local
// - Posts each location to /api/admin/clients
// - Uses "PENDING" as google_place_id placeholder — update via the admin Edit
//   button once real Place IDs are known
// - Idempotent: if a slug is already taken (409) it skips that location

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ENV_PATH = resolve(process.cwd(), '.env.local')
if (existsSync(ENV_PATH)) {
  for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

const ADMIN_SECRET = process.env.ADMIN_SECRET
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://reviews.seenai.digital').replace(/\/$/, '')
if (!ADMIN_SECRET) {
  console.error('ADMIN_SECRET not set — add it to .env.local')
  process.exit(1)
}

const NOTIFICATION_EMAIL = 'Hello@Lovmedspa.com'

const SERVICES = [
  'Botox', 'Xeomin', 'Daxxify',
  'Dermal Filler', 'Lip Filler', 'Cheek Filler', 'Jawline Filler', 'Tear Trough Filler',
  'Masseter Botox', 'Trapezius Botox',
  'CO2 Laser', 'Morpheus8', 'PDO Thread Lift', 'Liquid BBL',
  'Sculptra', 'RADIESSE',
  'HydraFacial', 'Classic Facial', 'Dermaplaning', 'Chemical Peel', 'Microneedling',
  'PRP Hair Loss', 'PRF EZ Gel',
  'Semaglutide', 'Tirzepatide',
]

const TEAM = [
  'Dr. Ahmed Elsoury, MD',
  'Mark Ennett, PhD, CRNA',
  'Maytal Dayan, DNP, FNP-C',
  'Mohiba Rafiq, ACNP, RNFA',
  'Riyeon Kim, MSN, RN, OCN',
  'Kaisha Jean-Louis, RN, BSN',
  'Alexander Moon',
  'Kee Osawagara (Esthetician)',
  'Andrea Herrera (Facial Specialist)',
  'Raimah Samndarh (Facial Specialist)',
]

const LOCATIONS = [
  {
    slug: 'lovmedspa-brooklyn',
    location_city: 'Brooklyn, NY',
    location_address: '1 Boerum Pl Suite 252, Brooklyn, NY 11201',
  },
  {
    slug: 'lovmedspa-manhattan',
    location_city: 'Manhattan, NY',
    location_address: '124 West 24th Street, Suite 41, New York, NY 10011',
  },
  {
    slug: 'lovmedspa-staten-island',
    location_city: 'Staten Island, NY',
    location_address: '2656 Hylan Blvd, Studio 17, Staten Island, NY 10306',
  },
  {
    slug: 'lovmedspa-miami',
    location_city: 'Miami, FL',
    location_address: '21010 W Dixie Hwy, Miami, FL 33180',
  },
  {
    slug: 'lovmedspa-west-farms',
    location_city: 'Farmington, CT',
    location_address: '1600 SE Road, Suite 11, Farmington, CT 06032',
  },
]

function payload(loc) {
  return {
    slug: loc.slug,
    business_name: 'LovMedSpa',
    location_address: loc.location_address,
    location_city: loc.location_city,
    google_place_id: 'PENDING',
    notification_email: NOTIFICATION_EMAIL,
    brand_color_primary: '#c9a87c',
    brand_color_secondary: '#a01b1b',
    services: SERVICES,
    team_members: TEAM,
    daily_ai_limit: 50,
  }
}

const endpoint = `${APP_URL}/api/admin/clients`
const headers = {
  'Content-Type': 'application/json',
  'x-admin-secret': ADMIN_SECRET,
}

console.log(`\n  Seeding ${LOCATIONS.length} LovMedSpa locations → ${APP_URL}\n`)

let created = 0
let skipped = 0
let failed = 0

for (const loc of LOCATIONS) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload(loc)),
  })
  const body = await res.json().catch(() => ({}))

  if (res.status === 201) {
    console.log(`  ✓ created  /${loc.slug}`)
    created++
  } else if (res.status === 409) {
    console.log(`  · exists   /${loc.slug}`)
    skipped++
  } else {
    console.log(`  ✗ failed   /${loc.slug}  [${res.status}]  ${JSON.stringify(body)}`)
    failed++
  }
}

console.log(`\n  Created: ${created}   Skipped: ${skipped}   Failed: ${failed}\n`)
console.log('  Next: paste the 5 Google Place IDs and they will be patched in place.\n')
process.exit(failed ? 1 : 0)
