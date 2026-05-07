// Import upcoming Fences-veilingen 2026 zoals vermeld op
// /calendrier-ventes-fences/. De pagina toont alleen titels + datums
// (geen lots) — die importeren we als 'planned'-collecties zodat ze
// op het Fences-houseoverzicht verschijnen.

import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)

const Y = 2026
const auctions = [
  { name: 'La Vente de Deauville Sélection ' + Y,       date: `${Y}-06-29`, location: 'Deauville, Frankrijk' },
  { name: 'La Deauville Classic Auction ' + Y,          date: `${Y}-08-15`, location: 'Deauville, Frankrijk' },
  { name: 'Les Ventes Élite ' + Y,                      date: `${Y}-09-02`, location: 'Lamotte-Beuvron, Frankrijk' },
  { name: 'La Vente de Service ' + Y,                   date: `${Y}-09-06`, location: 'Lamotte-Beuvron, Frankrijk' },
]

const { data: house, error: hErr } = await sb
  .from('auction_houses').select('id, name').ilike('name', '%fences%').single()
if (hErr || !house) { console.error('❌ Fences-huis niet gevonden'); process.exit(1) }
console.log(`🏠 ${house.name}`)

let n = 0
for (const a of auctions) {
  const { error } = await sb.from('collections').upsert({
    house_id: house.id,
    name: a.name,
    date: a.date,
    location: a.location,
    status: 'planned',
  }, { onConflict: 'house_id,name' })
  if (error) console.error(` ⚠ ${a.name}: ${error.message}`)
  else { console.log(` + ${a.name} — ${a.date}`); n++ }
}
console.log(`\n✅ ${n} veilingen aangemaakt/geüpdatet`)
