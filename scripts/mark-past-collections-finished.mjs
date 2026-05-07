// Markeer alle veilingen waarvan de datum in het verleden ligt als
// "afgesloten" (dat is de status die de UI gebruikt voor "gehamerd"-veilingen).

import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)

const today = new Date().toISOString().slice(0, 10)

// Lots zonder datum tellen niet (kunnen we niet bepalen).
const { data: cs, error } = await sb
  .from('collections')
  .select('id, name, date, status')
  .lt('date', today)
  .neq('status', 'afgesloten')

if (error) { console.error(error.message); process.exit(1) }
console.log(`📋 ${cs.length} collecties met datum < ${today} en status ≠ 'afgesloten'`)
for (const c of cs.slice(0, 10)) console.log(`  - ${c.name} (${c.date}) status=${c.status}`)
if (cs.length > 10) console.log(`  ... en ${cs.length - 10} meer`)

if (cs.length === 0) { console.log('Niets te updaten.'); process.exit(0) }

const ids = cs.map(c => c.id)
const { error: uErr } = await sb
  .from('collections')
  .update({ status: 'afgesloten' })
  .in('id', ids)

if (uErr) { console.error(uErr.message); process.exit(1) }
console.log(`\n✅ ${cs.length} collecties op 'afgesloten' gezet`)
