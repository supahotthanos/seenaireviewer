#!/usr/bin/env node
// Generate one "Main QR" per location and save PNGs to /qrcodes/.
// Run:  node scripts/generate-qrs.mjs

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
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

const SECRET = process.env.ADMIN_SECRET
if (!SECRET) { console.error('ADMIN_SECRET missing'); process.exit(1) }
const APP = 'https://reviews.seenai.digital'
const OUT_DIR = resolve(process.cwd(), 'qrcodes')
mkdirSync(OUT_DIR, { recursive: true })

// Label every QR as "Main QR" so you can add more labeled codes later
// (Front Desk, Treatment Room, Business Card, etc.) without collision.
const LABEL = 'Main QR'

const headers = {
  'Content-Type': 'application/json',
  'x-admin-secret': SECRET,
}

const { clients } = await (await fetch(`${APP}/api/admin/clients`, { headers })).json()

if (!clients || clients.length === 0) {
  console.error('No clients returned from API')
  process.exit(1)
}

console.log(`\n  Generating ${LABEL} for ${clients.length} locations →  ${OUT_DIR}\n`)

let ok = 0, fail = 0
for (const c of clients) {
  const res = await fetch(`${APP}/api/admin/qr-generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ client_id: c.id, label: LABEL }),
  })
  if (!res.ok) {
    console.log(`  ✗ ${c.slug}  [${res.status}]`)
    fail++
    continue
  }
  const { short_code, qr_url, qr_data_url } = await res.json()
  // Decode data URL → PNG buffer
  const b64 = qr_data_url.split(',')[1]
  const png = Buffer.from(b64, 'base64')
  const filename = `${c.slug}__${short_code}.png`
  writeFileSync(resolve(OUT_DIR, filename), png)
  console.log(`  ✓ ${c.slug.padEnd(26)}  ${short_code}  →  ${filename}`)
  console.log(`     scan URL: ${qr_url}`)
  ok++
}

console.log(`\n  Generated: ${ok}   Failed: ${fail}`)
console.log(`  Folder:    ${OUT_DIR}\n`)
