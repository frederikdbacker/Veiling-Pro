#!/usr/bin/env node
/**
 * Verrijk BESTAANDE lots met de pedigree-velden uit een scrape-JSON, zonder
 * de lots te verwijderen of andere velden aan te raken. Non-destructief:
 * updatet enkel `pedigree` (3-generatie-jsonb), `sire`, `dam` en `missing_info`
 * (zodat het "ontbreekt"-vlaggetje klopt na het vullen van de afstamming) per
 * lot, gematcht op (collection_id, number).
 *
 * Bedoeld om een collectie die al geïmporteerd is (via import-lots.mjs) achteraf
 * van een volledige stamboom te voorzien (bv. nadat de scraper die later kon
 * ophalen). Idempotent: opnieuw runnen overschrijft dezelfde waarden.
 *
 * Gebruik:
 *   node --env-file=.env.local scripts/update-pedigree-from-scrape.mjs <scrape.json> <collection_id>
 */

import { readFile } from 'node:fs/promises'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const file = process.argv[2]
const collectionId = process.argv[3]

if (!URL || !KEY || !file || !collectionId) {
  console.error('Usage: node --env-file=.env.local scripts/update-pedigree-from-scrape.mjs <scrape.json> <collection_id>')
  process.exit(1)
}

const { horses } = JSON.parse(await readFile(file, 'utf8'))
if (!Array.isArray(horses)) { console.error('❌ Geen horses[] in het bestand.'); process.exit(1) }

let ok = 0, skip = 0, fail = 0
for (const h of horses) {
  if (h.lot_number == null) { skip++; continue }
  if (!h.pedigree && !h.sire && !h.dam) { skip++; continue }
  const url = `${URL}/rest/v1/lots`
    + `?collection_id=eq.${collectionId}`
    + `&number=eq.${encodeURIComponent(h.lot_number)}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      pedigree: h.pedigree ?? null,
      sire: h.sire ?? null,
      dam: h.dam ?? null,
      ...(Array.isArray(h.missing_info) ? { missing_info: h.missing_info } : {}),
    }),
  })
  if (!res.ok) { console.error(`❌ #${h.lot_number} — HTTP ${res.status}: ${await res.text()}`); fail++; continue }
  const updated = await res.json()
  if (!updated.length) { console.warn(`⚠ #${h.lot_number} — geen rij gevonden`); skip++; continue }
  console.log(`✓ #${h.lot_number} ${updated[0].name} → ${h.sire || '?'} × ${h.dam || '?'}`)
  ok++
}
console.log(`\nKlaar: ${ok} verrijkt, ${skip} overgeslagen, ${fail} mislukt.`)
process.exit(fail > 0 ? 1 : 0)
