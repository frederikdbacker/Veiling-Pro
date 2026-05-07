// Markeer alle lots in Zangersheide Friday Foals + Saturday Foals
// collecties als lot_type "Veulen" (key=foal).

import { createClient } from '@supabase/supabase-js'

const url  = process.env.VITE_SUPABASE_URL
const key  = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(url, key)

// 1. Vind het foal lot_type
const { data: lt, error: ltErr } = await sb
  .from('lot_types')
  .select('id, key, name_nl')
  .eq('key', 'foal')
  .single()

if (ltErr || !lt) { console.error('❌ Geen foal-type:', ltErr?.message); process.exit(1) }
console.log(`✅ foal type: ${lt.id} (${lt.name_nl})`)

// 2. Vind matching collecties
const { data: colls, error: cErr } = await sb
  .from('collections')
  .select('id, name')
  .or('name.ilike.%Quality Auction - Saturday Foals%,name.ilike.%Quality Auction - Friday Foals%')

if (cErr) { console.error('❌ Collecties:', cErr.message); process.exit(1) }
console.log(`📋 ${colls.length} matching collecties:`)
for (const c of colls) console.log(`   - ${c.name} (${c.id})`)

if (colls.length === 0) {
  console.log('Geen collecties gevonden — niets te doen.')
  process.exit(0)
}

// 3. Update lots in die collecties
const collIds = colls.map((c) => c.id)
const { data: updated, error: uErr } = await sb
  .from('lots')
  .update({ lot_type_id: lt.id, lot_type: 'horse' }) // lot_type tekst-kolom blijft 'horse', enkel FK relevant
  .in('collection_id', collIds)
  .select('id, name, collection_id')

if (uErr) { console.error('❌ Update:', uErr.message); process.exit(1) }
console.log(`\n✅ ${updated.length} lots gemarkeerd als Veulen`)
