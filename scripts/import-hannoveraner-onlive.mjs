// Import upcoming OnLive-veilingen van Hannoveraner Verband.
// Statisch gedefinieerd op basis van de pagina /en/verden-auction/
// (laatst geverifieerd 2026-05-07). Frederik kan datums later bijwerken
// in de UI; doel hier is initiële kalender.

import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)

const auctions = [
  { name: 'Verden Auction YoungSTARS OnLive (Foals)',     date: '2026-05-30' },
  { name: '52. Elite-Foal- and Broodmare-Auction OnLive', date: '2026-07-25' },
  { name: 'Verden Championship OnLive',                   date: '2026-08-08' },
  { name: '143rd Elite-Auction OnLive (Riding horses)',   date: '2026-10-10' },
  { name: '143rd Elite-Auction OnLive (Foals)',           date: '2026-10-11' },
  { name: 'Verden Stallion Licensing - Dressage OnLive',  date: '2026-11-20' },
  { name: 'Verden Stallion Licensing - Jumping OnLive',   date: '2026-11-27' },
]

const { data: house, error: hErr } = await sb
  .from('auction_houses')
  .select('id, name')
  .eq('name', 'Hannoveraner Verband')
  .single()
if (hErr || !house) { console.error('❌ Hannoveraner Verband niet gevonden'); process.exit(1) }
console.log(`🏠 ${house.name}`)

let inserted = 0, skipped = 0
for (const a of auctions) {
  const { error } = await sb.from('collections').upsert({
    house_id: house.id,
    name: a.name,
    date: a.date,
    location: 'Verden, Duitsland',
    status: 'planned',
  }, { onConflict: 'house_id,name' })
  if (error) {
    console.error(` ⚠ ${a.name}: ${error.message}`)
    skipped++
  } else {
    console.log(` + ${a.name} — ${a.date}`)
    inserted++
  }
}
console.log(`\n✅ ${inserted} aangemaakt/geüpdatet, ${skipped} overgeslagen`)
