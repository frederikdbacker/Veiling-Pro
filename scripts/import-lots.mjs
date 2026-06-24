// Import lots vanuit een JSON-bestand naar de Supabase lots-tabel.
//
// Verwacht JSON-vorm:
//   { meta: { collection, website, ... }, horses: [ { ...lot fields } ] }
//
// Auction house wordt afgeleid uit het eerste woord van meta.collection
// (bv. "Aloga Auction 2026" → house "Aloga").
//
// Gebruik:
//   node --env-file=.env.local scripts/import-lots.mjs data/aloga-2026-import.json

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { ensureDays, resolveDayId } from './lib/days.mjs'

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

if (!meta?.collection || !Array.isArray(horses)) {
  console.error('❌ JSON heeft geen meta.collection of horses[] — formaat klopt niet.')
  process.exit(1)
}

console.log(`📦 ${meta.collection}: ${horses.length} paarden`)

// 1) auction_house — upsert op naam.
//    meta.house override is leidend (voor huizen waarvan de naam niet
//    het eerste woord van de collection-naam is, bv. "334 Auction").
//    Anders fallback naar eerste woord.
const houseName = meta.house || meta.collection.split(' ')[0]
const housePayload = { name: houseName }
if (meta.website) housePayload.website = meta.website
if (meta.house_country) housePayload.country = meta.house_country
const { data: house, error: hErr } = await supabase
  .from('auction_houses')
  .upsert(housePayload, { onConflict: 'name' })
  .select()
  .single()

if (hErr) { console.error('❌ House:', hErr.message); process.exit(1) }
console.log(`🏛  House: ${house.name} (${house.id})`)

// 2) collection — upsert op (house_id, name)
const collectionPayload = { house_id: house.id, name: meta.collection.trim() }
if (meta.date)     collectionPayload.date = meta.date
if (meta.location) collectionPayload.location = meta.location
if (meta.status)   collectionPayload.status = meta.status
if (meta.notes)    collectionPayload.notes = meta.notes
if (meta.time_auction_start) collectionPayload.time_auction_start = meta.time_auction_start
const { data: collection, error: aErr } = await supabase
  .from('collections')
  .upsert(collectionPayload, { onConflict: 'house_id,name' })
  .select()
  .single()

if (aErr) { console.error('❌ Auction:', aErr.message); process.exit(1) }
console.log(`🎯 Auction: ${collection.name} (${collection.id})`)

// 2a) veilingdagen (migratie 0031). meta.days = array ISO-datums voor een
//     meerdaagse verkoop; anders één dag met meta.date. Paarden kunnen via
//     h.day_index (1-based) of h.day_date aan een dag gekoppeld worden;
//     zonder dag-info landen ze op dag 1 (zichtbaar in de cockpit).
const dayDates = Array.isArray(meta.days) && meta.days.length > 0
  ? meta.days
  : (meta.date ? [meta.date] : [])
let days = []
try {
  days = await ensureDays(supabase, collection.id, dayDates)
  if (dayDates[0] && collection.date !== dayDates[0]) {
    await supabase.from('collections').update({ date: dayDates[0] }).eq('id', collection.id)
  }
  console.log(`📅 Veilingdagen: ${days.length}`)
} catch (e) { console.error('❌ Veilingdagen:', e.message); process.exit(1) }
const day1Id = days[0]?.id ?? null

// 2b) lot_types ophalen voor auto-derive (zie migratie 0013)
const { data: lotTypes, error: tErr } = await supabase
  .from('lot_types')
  .select('id, name_nl')

if (tErr) { console.error('❌ Lot types:', tErr.message); process.exit(1) }
if (!lotTypes || lotTypes.length === 0) {
  console.error('❌ Geen lot_types gevonden — seed-rows ontbreken.')
  process.exit(1)
}

const findType = (re) => lotTypes.find(t => re.test(t.name_nl))
const embryoType = findType(/embryo/i)
const veulenType = findType(/veulen/i)
const twoYearType = findType(/2[-\s]?jarig/i)
const threeYearType = findType(/3[-\s]?jarig/i)
const fallbackType = findType(/spring/i) ?? lotTypes[0]
const currentYear = new Date().getFullYear()

function deriveLotType(h) {
  // Regel 1: geen jaar → embryo (auto)
  if (!h.year && embryoType) return embryoType.id
  // Regel 2: jaar = lopend kalenderjaar → veulen (auto)
  if (h.year === currentYear && veulenType) return veulenType.id
  // Regel 3: leeftijd → 2-jarigen / 3-jarigen (migratie 0026)
  if (h.year === currentYear - 2 && twoYearType)   return twoYearType.id
  if (h.year === currentYear - 3 && threeYearType) return threeYearType.id
  // Regel 4: discipline matchen op type-naam
  if (h.discipline) {
    const d = h.discipline.toLowerCase()
    const match = lotTypes.find(t =>
      t.name_nl.toLowerCase().includes(d) || d.includes(t.name_nl.toLowerCase())
    )
    if (match) return match.id
  }
  // Fallback
  return fallbackType.id
}

console.log(`📋 Lot types: ${lotTypes.length} — embryo:${!!embryoType} veulen:${!!veulenType} 2j:${!!twoYearType} 3j:${!!threeYearType}`)

// 3) check of er al lots staan voor deze collection (geen dubbele import)
const { count } = await supabase
  .from('lots')
  .select('id', { count: 'exact', head: true })
  .eq('collection_id', collection.id)

if (count && count > 0) {
  console.error(`⚠  Er staan al ${count} lots voor deze veiling. Import afgebroken.`)
  console.error('   Verwijder ze eerst handmatig in Supabase als je opnieuw wil importeren.')
  process.exit(1)
}

// 4) map horses naar lot-rijen
const rows = horses.map(h => ({
  collection_id:        collection.id,
  collection_day_id: resolveDayId(h, days, day1Id),
  lot_type_id:       deriveLotType(h),
  lot_type_auto:     true,
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
  // Auction page-link (#10a uit POST_ALOGA_ROADMAP.md) — bron-URL
  // automatisch in dit veld zodat het cockpit-logo direct werkt na
  // import. Frederik kan handmatig overschrijven via LotPage indien
  // de scrape-bron afwijkt van de gewenste auction-page-URL.
  url_extra:         h.source_url ?? null,
  // Afstammingslinks (migratie 0005) — doorgeven indien de scraper ze
  // meelevert (bv. Olympic Dream Auction: Horse Telex per paard).
  url_horsetelex:    h.url_horsetelex ?? null,
  url_hippomundo:    h.url_hippomundo ?? null,
  start_price:       h.starting_bid,
  reserve_price:     h.reserve_price,
  // bid_steps verhuisd naar collections-tabel (per migratie 0002).
  // Niet meer per lot mappen; eventueel toekomstige meta.bid_steps
  // wordt op collection-niveau geüpsert.
  // Notitievelden — sinds migratie 0014 zijn notes_org → notes_organisatie
  // hernoemd en zijn er 4 nieuwe rubrieken bij. notes_catalog en notes_video
  // bestaan nog (deprecated, drop volgt) maar worden niet meer ingevuld vanuit
  // import — Frederik vult die handmatig in de UI.
  notes_organisatie: h.notes?.org || null,
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
