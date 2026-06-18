#!/usr/bin/env node
/**
 * Importeer pedigrees in lots.pedigree (jsonb) voor Schuttert Sport Sales 2026.
 *
 * Leest data/schuttert-2026-pedigree.json en updatet voor elke slug
 * het lots.pedigree-veld via Supabase REST API, gefilterd op de
 * collection_id van Schuttert Sport Sales 2026.
 *
 * Gebruik:
 *   node --env-file=.env.local scripts/import-schuttert-pedigree.mjs
 *
 * Idempotent: opnieuw runnen overschrijft dezelfde waarden.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!URL || !KEY) {
  console.error('❌ Env vars ontbreken. Run met: node --env-file=.env.local scripts/import-schuttert-pedigree.mjs')
  process.exit(1)
}

// Schuttert Sport Sales 2026 — collection_id uit de import-run.
const COLLECTION_ID = '93e8f725-a86b-42ec-8fb5-fca50bd12433'

const dataFile = path.join(ROOT, 'data/schuttert-2026-pedigree.json')
const raw = await fs.readFile(dataFile, 'utf8')
const pedigrees = JSON.parse(raw)

const entries = Object.entries(pedigrees).filter(([k]) => !k.startsWith('_'))
console.log(`📚 ${entries.length} pedigrees gevonden in ${path.basename(dataFile)}`)

let ok = 0, fail = 0, missing = 0

for (const [slug, pedigree] of entries) {
  const url = `${URL}/rest/v1/lots`
    + `?slug=eq.${encodeURIComponent(slug)}`
    + `&collection_id=eq.${COLLECTION_ID}`

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ pedigree }),
  })

  if (!res.ok) {
    console.error(`❌ ${slug} — HTTP ${res.status}: ${await res.text()}`)
    fail++
    continue
  }
  const updated = await res.json()
  if (!updated || updated.length === 0) {
    console.warn(`⚠ ${slug} — geen lot gevonden voor deze collection_id`)
    missing++
    continue
  }
  console.log(`✓ ${slug}  → ${updated[0].name}`)
  ok++
}

console.log(`\nKlaar: ${ok} ge-update, ${missing} niet-gevonden, ${fail} mislukt.`)
process.exit(fail > 0 ? 1 : 0)
