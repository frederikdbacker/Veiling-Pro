// Merge "Aloga" (id 2d16a824) → "Aloga Auction" (id a9bdda3d).
// Verplaats collecties en verwijder het duplicate huis.

import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)

const KEEP   = 'a9bdda3d-63ef-491a-8b7f-e3201248c27f' // Aloga Auction
const REMOVE = '2d16a824-f9e7-458f-889b-af8e8e2cfc74' // Aloga

const { data: colls } = await sb.from('collections').select('id, name').eq('house_id', REMOVE)
console.log(`Te verplaatsen: ${colls.length} collectie(s)`)
for (const c of colls) console.log(`  - ${c.name}`)

const { error } = await sb.from('collections').update({ house_id: KEEP }).eq('house_id', REMOVE)
if (error) { console.error(error.message); process.exit(1) }

const { error: dErr } = await sb.from('auction_houses').delete().eq('id', REMOVE)
if (dErr) { console.error(dErr.message); process.exit(1) }
console.log('✅ Aloga gemerged naar Aloga Auction')
