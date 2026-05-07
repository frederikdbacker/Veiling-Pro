// Importeer een fences-ventes-X.json file: bevat meerdere collections.
// Elke collection (= 1 datum) wordt apart geüpsert; bestaande collections
// met al lots worden overgeslagen (idempotent).

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)

const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/import-fences-ventes.mjs <file>'); process.exit(1) }

const { collections } = JSON.parse(await readFile(file, 'utf8'))
console.log(`📦 ${collections.length} collecties in ${file}`)

// 1. Vind het Fences-huis
const { data: house } = await sb
  .from('auction_houses').select('id, name').ilike('name', '%fences%').single()
console.log(`🏠 ${house.name}`)

// 2. Lot-types
const { data: lotTypes } = await sb.from('lot_types').select('id, name_nl')
const findType = (re) => lotTypes.find((t) => re.test(t.name_nl))
const fallback = findType(/spring/i) ?? lotTypes[0]

let totalInserted = 0, totalSkipped = 0
for (const c of collections) {
  const collPayload = {
    house_id: house.id,
    name: c.meta.collection,
    date: c.meta.date,
    status: c.meta.status,
    notes: c.meta.notes_organisatie ? null : null, // schema-veld 'notes' niet meer in gebruik; we slaan type op in collection-naam
  }
  const { data: coll, error: cErr } = await sb
    .from('collections')
    .upsert(collPayload, { onConflict: 'house_id,name' })
    .select()
    .single()
  if (cErr) { console.error(`  ⚠ ${c.meta.collection}: ${cErr.message}`); continue }

  // bestaande lots tellen
  const { count } = await sb.from('lots').select('id', { count: 'exact', head: true }).eq('collection_id', coll.id)
  if (count > 0) {
    console.log(`  ⏭️  ${c.meta.collection} — ${count} lots bestaan al`)
    totalSkipped += c.horses.length
    continue
  }

  const rows = c.horses.map((h) => ({
    collection_id: coll.id,
    lot_type_id: fallback.id,
    lot_type_auto: true,
    name: h.name,
    slug: h.slug,
    discipline: h.discipline,
    sire: h.sire,
    dam: h.dam,
    sale_price: h.sale_price,
    sold: h.sold,
    source_url: h.source_url,
  }))
  const { data: lots, error: lErr } = await sb.from('lots').insert(rows).select('id')
  if (lErr) { console.error(`  ⚠ ${c.meta.collection}: ${lErr.message}`); continue }
  console.log(`  ✅ ${c.meta.collection} — ${lots.length} lots`)
  totalInserted += lots.length
}

console.log(`\n🎯 Klaar: ${totalInserted} ingevoegd, ${totalSkipped} overgeslagen`)
