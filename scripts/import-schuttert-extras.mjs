// Extras voor Schuttert Sport Sales:
//   1. House.website → homepage; house.logo_url → site-logo
//   2. Twee comitéleden (Hendrik Jan + Sally Schuttert) als "Eigenaar"
//
// Gebruik:
//   node --env-file=.env.local scripts/import-schuttert-extras.mjs

import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)

const HOUSE_NAME = 'Schuttert Sport Sales'
const HOMEPAGE   = 'https://schuttertsportsales.com/'
const LOGO_URL   = 'https://schuttertsportsales.com/wp-content/uploads/Logo-SSS-def-secondary-grey-text.png'

const { data: house, error: hErr } = await sb
  .from('auction_houses')
  .select('id, name')
  .eq('name', HOUSE_NAME)
  .single()
if (hErr || !house) { console.error('❌ Huis niet gevonden:', hErr?.message); process.exit(1) }
console.log(`🏠 ${house.name} (${house.id})`)

// 1. House-update
const { error: upErr } = await sb
  .from('auction_houses')
  .update({ website: HOMEPAGE, logo_url: LOGO_URL, country: 'Nederland' })
  .eq('id', house.id)
if (upErr) { console.error('❌ House-update:', upErr.message); process.exit(1) }
console.log(`✅ House.website + logo_url geüpdatet`)

// 2. Comitéleden — Hendrik Jan + Sally Schuttert (eigenaren / organisatoren)
const members = [
  { name: 'Hendrik Jan Schuttert', role: 'Eigenaar', display_order: 0 },
  { name: 'Sally Schuttert',       role: 'Eigenaar', display_order: 1 },
]

for (const m of members) {
  const { data: existing } = await sb
    .from('house_committee_members')
    .select('id')
    .eq('house_id', house.id)
    .eq('name', m.name)
    .maybeSingle()

  if (existing) {
    await sb.from('house_committee_members')
      .update({ role: m.role, display_order: m.display_order })
      .eq('id', existing.id)
    console.log(`  ↻ ${m.name}`)
  } else {
    await sb.from('house_committee_members')
      .insert({ house_id: house.id, ...m })
    console.log(`  + ${m.name}`)
  }
}

console.log('\n✅ Klaar')
