// Importeer een gescrapete Fences-catalogus-JSON (scrape-fences-catalogus.mjs)
// in de BESTAANDE planned-collectie (we maken er geen nieuwe aan).
//
//   node --env-file=.env.local scripts/import-fences-catalogus.mjs <json> [naam-deel]
//
// - Weigert te importeren als de scrape onvolledig was (meta.stopped_reason).
// - Idempotent: stopt als de collectie al lots heeft.
// - lot_type_id (verplicht) wordt afgeleid zoals in import-lots.mjs.
// - Röntgenfoto's (/radio/) worden uit photos gefilterd.

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { ensureDays, resolveDayId } from './lib/days.mjs'

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)
const file = process.argv[2]
const nameMatch = process.argv[3] || 'élection'
if (!file) { console.error('Usage: node scripts/import-fences-catalogus.mjs <json> [naam-deel]'); process.exit(1) }

const { meta, horses } = JSON.parse(await readFile(file, 'utf8'))
if (meta.stopped_reason) {
  console.error(`❌ Scrape was ONVOLLEDIG (stopped_reason: ${meta.stopped_reason}). Niet importeren.`)
  process.exit(1)
}
if (!horses?.length) { console.error('❌ Geen paarden in de JSON.'); process.exit(1) }
console.log(`📦 ${horses.length} paarden uit ${file}`)

// Fences-huis + exact één doelcollectie
const { data: house } = await sb.from('auction_houses').select('id, name').ilike('name', '%fences%').single()
const { data: colls, error: cErr } = await sb.from('collections')
  .select('id, name, status').eq('house_id', house.id).ilike('name', `%${nameMatch}%`)
if (cErr) { console.error(cErr.message); process.exit(1) }
if (!colls || colls.length !== 1) {
  console.error(`❌ Verwachtte precies 1 collectie met '${nameMatch}', vond ${colls?.length || 0}.`); process.exit(1)
}
const coll = colls[0]
console.log(`🎯 Collectie: ${coll.name} (${coll.status})`)

// Idempotent
const { count } = await sb.from('lots').select('id', { count: 'exact', head: true }).eq('collection_id', coll.id)
if (count > 0) { console.error(`⏭️  ${count} lots bestaan al — gestopt (geen dubbele import).`); process.exit(1) }

// Veilingdagen (migratie 0031). De collectie heeft die meestal al via
// import-fences-calendrier.mjs (bv. Deauville Sélection = 2 dagen). De
// gescrapete catalogus bevat GÉÉN dag-veld (één catalogus-URL voor beide
// dagen), dus alle lots landen op dag 1; Frederik herverdeelt daarna in de
// UI of via scrape-fences-ordre-passage.mjs. Een paard met h.day_index of
// h.day_date wordt wél meteen juist gekoppeld.
const days = await ensureDays(sb, coll.id, [])  // garandeert minstens dag 1
const day1Id = days[0]?.id ?? null
console.log(`📅 Veilingdagen: ${days.length} — onbekende dag → dag 1`)

// lot_type-afleiding (zelfde regels als import-lots.mjs)
const { data: lotTypes } = await sb.from('lot_types').select('id, name_nl')
const findType = (re) => lotTypes.find((t) => re.test(t.name_nl))
const veulenType = findType(/veulen/i), twoY = findType(/2[-\s]?jarig/i),
      threeY = findType(/3[-\s]?jarig/i), embryoType = findType(/embryo/i)
const springType = findType(/spring/i) ?? lotTypes[0]
const Y = new Date().getFullYear()
function deriveLotType(h) {
  if (!h.year && embryoType) return embryoType.id
  if (h.year === Y && veulenType) return veulenType.id
  if (h.year === Y - 2 && twoY) return twoY.id
  if (h.year === Y - 3 && threeY) return threeY.id
  return springType.id
}

const rows = horses.map((h) => ({
  collection_id: coll.id,
  collection_day_id: resolveDayId(h, days, day1Id),
  lot_type_id: deriveLotType(h),
  lot_type_auto: true,
  number: h.lot_number,
  name: h.name,
  slug: h.slug,
  discipline: h.discipline,
  year: h.year,
  gender: h.gender,
  studbook: h.studbook,
  sire: h.sire,
  dam: h.dam,
  photos: (h.photos || []).filter((p) => !/\/radio\//i.test(p)),
  source_url: h.source_url,
}))

const { data: inserted, error: lErr } = await sb.from('lots').insert(rows).select('id')
if (lErr) { console.error(`❌ Insert-fout: ${lErr.message}`); process.exit(1) }
console.log(`✅ ${inserted.length} lots ingevoegd in "${coll.name}" (status blijft ${coll.status}).`)
