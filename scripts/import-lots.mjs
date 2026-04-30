// Import lots vanuit een JSON-bestand naar de Supabase lots-tabel.
//
// Verwacht JSON-vorm:
//   { meta: { auction, website, ... }, horses: [ { ...lot fields } ] }
//
// Auction house wordt afgeleid uit het eerste woord van meta.auction
// (bv. "Aloga Auction 2026" → house "Aloga").
//
// Gebruik:
//   node --env-file=.env.local scripts/import-lots.mjs data/aloga-2026-import.json

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.error('❌ Env vars ontbreken. Run met: node --env-file=.env.local scripts/import-lots.mjs <file>')
  process.exit(1)
}

const file = process.argv[2]
if (!file) {
  console.error('Usage: node --env-file=.env.local scripts/import-lots.mjs <json-file>')
  process.exit(1)
}

const supabase = createClient(url, key)

const json = JSON.parse(await readFile(file, 'utf8'))
const { meta, horses } = json

if (!meta?.auction || !Array.isArray(horses)) {
  console.error('❌ JSON heeft geen meta.auction of horses[] — formaat klopt niet.')
  process.exit(1)
}

console.log(`📦 ${meta.auction}: ${horses.length} paarden`)

// 1) auction_house — upsert op naam
const houseName = meta.auction.split(' ')[0]
const { data: house, error: hErr } = await supabase
  .from('auction_houses')
  .upsert({ name: houseName, website: meta.website }, { onConflict: 'name' })
  .select()
  .single()

if (hErr) { console.error('❌ House:', hErr.message); process.exit(1) }
console.log(`🏛  House: ${house.name} (${house.id})`)

// 2) auction — upsert op (house_id, name)
const { data: auction, error: aErr } = await supabase
  .from('auctions')
  .upsert(
    { house_id: house.id, name: meta.auction },
    { onConflict: 'house_id,name' }
  )
  .select()
  .single()

if (aErr) { console.error('❌ Auction:', aErr.message); process.exit(1) }
console.log(`🎯 Auction: ${auction.name} (${auction.id})`)

// 3) check of er al lots staan voor deze auction (geen dubbele import)
const { count } = await supabase
  .from('lots')
  .select('id', { count: 'exact', head: true })
  .eq('auction_id', auction.id)

if (count && count > 0) {
  console.error(`⚠  Er staan al ${count} lots voor deze veiling. Import afgebroken.`)
  console.error('   Verwijder ze eerst handmatig in Supabase als je opnieuw wil importeren.')
  process.exit(1)
}

// 4) map horses naar lot-rijen
const rows = horses.map(h => ({
  auction_id:        auction.id,
  number:            h.lot_number,
  name:              h.name,
  slug:              h.slug,
  discipline:        h.discipline,
  year:              h.year,
  gender:            h.gender,
  size:              h.size,
  studbook:          h.studbook,
  sire:              h.sire,
  dam:               h.dam,
  pedigree_raw:      h.pedigree_raw,
  catalog_text:      h.catalog_text,
  equiratings_text:  h.equiratings_text,
  photos:            h.photos ?? [],
  video_url:         h.video_url,
  source_url:        h.source_url,
  start_price:       h.starting_bid,
  reserve_price:     h.reserve_price,
  // bid_steps verhuisd naar auctions-tabel (per migratie 0002).
  // Niet meer per lot mappen; eventueel toekomstige meta.bid_steps
  // wordt op auction-niveau geüpsert.
  notes_catalog:     h.notes?.catalog || null,
  notes_video:       h.notes?.video || null,
  notes_org:         h.notes?.org || null,
  usp:               h.usp || null,
  strong_points:     h.strong_points || null,
  weak_points:       h.weak_points || null,
  sold:              h.sold,
  sale_price:        h.sale_price,
  buyer:             h.buyer,
  buyer_country:     h.buyer_country,
  data_reliability:  h.data_reliability,
  // "bid_steps" filteren want het is geen lot-eigen veld meer.
  missing_info:      (h.missing_info ?? []).filter(k => k !== 'bid_steps'),
}))

// 5) insert
const { data: lots, error: lErr } = await supabase
  .from('lots')
  .insert(rows)
  .select('id, name')

if (lErr) { console.error('❌ Lots:', lErr.message); process.exit(1) }

console.log(`✅ ${lots.length} lots ingevoegd`)
lots.forEach((l, i) => console.log(`   ${(i + 1).toString().padStart(2)}. ${l.name}`))
