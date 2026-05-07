// De Zangersheide-imports vulden start_price in, maar dat zijn feitelijk
// verkoopprijzen. Migreer voor alle Zangersheide-lots (alle collecties van
// het veilinghuis "Zangersheide"):
//   - start_price → sale_price
//   - sold = true wanneer er een prijs is
//   - start_price → null (niet meer relevant; was foutieve waarde)

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const sb = createClient(url, key)

// 1. Vind het Zangersheide-huis
const { data: house, error: hErr } = await sb
  .from('auction_houses')
  .select('id, name')
  .ilike('name', 'Zangersheide%')
  .single()
if (hErr || !house) { console.error('❌ Zangersheide-huis niet gevonden'); process.exit(1) }
console.log(`🏠 ${house.name} (${house.id})`)

// 2. Alle collecties van Zangersheide
const { data: colls } = await sb
  .from('collections')
  .select('id, name')
  .eq('house_id', house.id)
console.log(`📋 ${colls.length} collecties`)

const collIds = colls.map((c) => c.id)

// 3. Lots met start_price > 0 in deze collecties
const { data: lots, error: lErr } = await sb
  .from('lots')
  .select('id, name, start_price, sale_price, sold, collection_id')
  .in('collection_id', collIds)
  .not('start_price', 'is', null)
  .gt('start_price', 0)

if (lErr) { console.error('❌', lErr.message); process.exit(1) }
console.log(`🐎 ${lots.length} lots met start_price > 0`)

// 4. Update in batches
let migrated = 0, skipped = 0
for (const lot of lots) {
  // Als sale_price al ingevuld is, overschrijf niet (handmatige correcties bewaren)
  if (lot.sale_price != null) { skipped++; continue }
  const { error: uErr } = await sb
    .from('lots')
    .update({
      sale_price: lot.start_price,
      sold: true,
      start_price: null,
    })
    .eq('id', lot.id)
  if (uErr) {
    console.error(`  ⚠ ${lot.name}: ${uErr.message}`)
    continue
  }
  migrated++
}

console.log(`\n✅ Gemigreerd: ${migrated}`)
console.log(`⏭️  Overgeslagen (sale_price bestond al): ${skipped}`)
