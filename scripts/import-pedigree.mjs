#!/usr/bin/env node
/**
 * Importeer pedigrees in lots.pedigree (jsonb).
 *
 * Leest data/aloga-2026-pedigree.json en updatet voor elke slug
 * het lots.pedigree-veld via Supabase REST API. Slug is uniek per
 * (collection_id, slug); we filteren ook op collection_id zodat als slug
 * in meerdere veilingen voorkomt alleen de Aloga-2026 wordt geraakt.
 *
 * Gebruik:
 *   node --env-file=.env.local scripts/import-pedigree.mjs
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
  console.error('❌ Env vars VITE_SUPABASE_URL en VITE_SUPABASE_PUBLISHABLE_KEY ontbreken.')
  console.error('   Run met: node --env-file=.env.local scripts/import-pedigree.mjs')
  process.exit(1)
}

// Aloga Auction 2026 — vast voor dit script. Pas aan als nodig.
const AUCTION_ID = 'bef304a5-29fc-47b3-af37-e808205ae60d'

const dataFile = path.join(ROOT, 'data/aloga-2026-pedigree.json')
const raw = await fs.readFile(dataFile, 'utf8')
const pedigrees = JSON.parse(raw)

// Filter het _note-veld weg
const entries = Object.entries(pedigrees).filter(([k]) => !k.startsWith('_'))

console.log(`📚 ${entries.length} pedigrees gevonden in ${path.basename(dataFile)}`)

let ok = 0, fail = 0, missing = 0

for (const [slug, pedigree] of entries) {
  const url = `${URL}/rest/v1/lots`
    + `?slug=eq.${encodeURIComponent(slug)}`
    + `&collection_id=eq.${AUCTION_ID}`

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
    const body = await res.text()
    console.error(`❌ ${slug} — HTTP ${res.status}: ${body}`)
    fail++
    continue
  }

  const updated = await res.json()
  if (!updated || updated.length === 0) {
    console.warn(`⚠ ${slug} — geen rij gevonden voor deze collection_id (slug klopt niet?)`)
    missing++
    continue
  }

  console.log(`✓ ${slug}  → ${updated[0].name}`)
  ok++
}

console.log()
console.log(`Klaar: ${ok} ge-update, ${missing} niet-gevonden, ${fail} mislukt.`)
process.exit(fail > 0 ? 1 : 0)
