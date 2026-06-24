// Import upcoming Fences-veilingen 2026 zoals vermeld op
// /calendrier-ventes-fences/. De pagina toont alleen titels + datums
// (geen lots) — die importeren we als 'planned'-collecties zodat ze
// op het Fences-houseoverzicht verschijnen.

import { createClient } from '@supabase/supabase-js'
import { ensureDays } from './lib/days.mjs'
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)

const Y = 2026
// `days`: meerdaagse verkopen krijgen één veilingdag per ISO-datum (migratie
// 0031). collections.date = de eerste dag (voor sortering/huisoverzicht).
// Eendaagse verkopen kunnen `date` houden; die krijgen automatisch 1 dag.
const auctions = [
  { name: 'La Vente de Deauville Sélection ' + Y, location: 'Deauville, Frankrijk',
    days: [`${Y}-06-29`, `${Y}-06-30`] },                      // ma 29 + di 30 juni
  { name: 'La Deauville Classic Auction ' + Y, location: 'Deauville, Frankrijk',
    date: `${Y}-08-15` },                                       // za 15 aug
  { name: 'Les Ventes Élite ' + Y, location: 'Lamotte-Beuvron, Frankrijk',
    days: [`${Y}-09-02`, `${Y}-09-03`, `${Y}-09-04`, `${Y}-09-05`] }, // wo 2 t/m za 5 sept
  { name: 'La Vente de Service ' + Y, location: 'Lamotte-Beuvron, Frankrijk',
    date: `${Y}-09-06` },                                       // zo 6 sept
]

const { data: house, error: hErr } = await sb
  .from('auction_houses').select('id, name').ilike('name', '%fences%').single()
if (hErr || !house) { console.error('❌ Fences-huis niet gevonden'); process.exit(1) }
console.log(`🏠 ${house.name}`)

let n = 0
for (const a of auctions) {
  const dayDates = a.days ?? (a.date ? [a.date] : [])
  const firstDate = dayDates[0] ?? null
  const { data: coll, error } = await sb.from('collections').upsert({
    house_id: house.id,
    name: a.name,
    date: firstDate,            // eerste/representatieve dag
    location: a.location,
    status: 'planned',
  }, { onConflict: 'house_id,name' }).select('id').single()
  if (error || !coll) { console.error(` ⚠ ${a.name}: ${error?.message}`); continue }
  try {
    const days = await ensureDays(sb, coll.id, dayDates)
    console.log(` + ${a.name} — ${dayDates.join(', ') || 'geen datum'} (${days.length} dag${days.length > 1 ? 'en' : ''})`)
    n++
  } catch (e) {
    console.error(` ⚠ ${a.name}: dagen — ${e.message}`)
  }
}
console.log(`\n✅ ${n} veilingen aangemaakt/geüpdatet (incl. veilingdagen)`)
