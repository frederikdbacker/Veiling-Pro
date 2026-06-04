#!/usr/bin/env node
/**
 * Importeer 3-generatie pedigrees in lots.pedigree (jsonb), gematcht op
 * lotnummer binnen één collectie.
 *
 * Leest een JSON-bestand van de vorm:
 *   {
 *     "collection_id": "725747f9-...",
 *     "pedigrees": {
 *       "1": { "sire": { "name": "...", "sire": {…}, "dam": {…} },
 *              "dam":  { "name": "...", "sire": {…}, "dam": {…} } },
 *       "2": { ... }
 *     }
 *   }
 *
 * Elke ouder-node = { name, sire, dam } waar sire/dam zelf weer
 * { name, sire, dam } (grootouder) zijn en hun sire/dam strings
 * (overgrootouders). Ontbrekende takken mogen null zijn.
 *
 * Gebruik:
 *   node --env-file=.env.local scripts/import-pedigree-by-number.mjs data/oda-pedigrees.json
 *
 * Idempotent: opnieuw runnen overschrijft dezelfde waarden.
 */

import { readFile } from 'node:fs/promises'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!URL || !KEY) {
  console.error('❌ Env vars ontbreken. Run met: node --env-file=.env.local scripts/import-pedigree-by-number.mjs <file>')
  process.exit(1)
}

const file = process.argv[2]
if (!file) {
  console.error('Usage: node --env-file=.env.local scripts/import-pedigree-by-number.mjs <json-file>')
  process.exit(1)
}

const json = JSON.parse(await readFile(file, 'utf8'))
const collectionId = json.collection_id
const pedigrees = json.pedigrees
if (!collectionId || !pedigrees || typeof pedigrees !== 'object') {
  console.error('❌ JSON mist collection_id of pedigrees{}.')
  process.exit(1)
}

const entries = Object.entries(pedigrees).filter(([k]) => !k.startsWith('_'))
console.log(`📚 ${entries.length} pedigrees → collectie ${collectionId}`)

let ok = 0, missing = 0, fail = 0
for (const [number, pedigree] of entries) {
  const url = `${URL}/rest/v1/lots`
    + `?collection_id=eq.${collectionId}`
    + `&number=eq.${encodeURIComponent(number)}`

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
    console.error(`❌ lot ${number} — HTTP ${res.status}: ${await res.text()}`)
    fail++
    continue
  }
  const updated = await res.json()
  if (!updated || updated.length === 0) {
    console.warn(`⚠ lot ${number} — geen rij gevonden in deze collectie`)
    missing++
    continue
  }
  console.log(`✓ lot ${number} → ${updated[0].name}`)
  ok++
}

console.log(`\nKlaar: ${ok} ge-update, ${missing} niet-gevonden, ${fail} mislukt.`)
process.exit(fail > 0 ? 1 : 0)
