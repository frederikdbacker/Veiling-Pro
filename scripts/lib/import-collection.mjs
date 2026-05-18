// Importeer een HORSE24-veilingcollectie in Supabase.
//
// LET OP — schema van de live-database:
//   - de veiling/collectie zit in de tabel  `collections`  (NIET `auctions`)
//   - lots verwijzen via  `lots.collection_id`  (NIET `auction_id`)
//
// Stappen (idempotent + veilig):
//   1. veilinghuis  — bestaand huis op naam hergebruiken, anders aanmaken
//   2. collection    — bestaande collection op (house_id,name) of naam
//                       hergebruiken; bestaande velden NIET overschrijven
//                       (enkel lege date/location/notes aanvullen)
//   3. lots           — alleen NIEUWE lots invoegen (op `number`).
//                       Bestaande lots blijven ongemoeid, zodat handmatige
//                       notities/prijzen/cockpit-data behouden blijven.
//
// Gebruikt door de CLI (scripts/import-from-url.mjs) en het Vite
// dev-endpoint (POST /api/import-collection).

import { resolveSource } from './sources/index.mjs'

function lotRow(collectionId, lotTypeId, h) {
  return {
    collection_id: collectionId,
    lot_type_id:   lotTypeId,
    number:        h.lot_number ?? null,
    name:          h.name ?? null,
    slug:          h.slug ?? null,
    discipline:    h.discipline ?? null,
    year:          h.year ?? null,
    gender:        h.gender ?? null,
    size:          h.size ?? null,
    studbook:      h.studbook ?? null,
    sire:          h.sire ?? null,
    dam:           h.dam ?? null,
    pedigree:      h.pedigree ?? null,
    pedigree_raw:  h.pedigree_raw ?? null,
    catalog_text:  h.catalog_text ?? null,
    photos:        h.photos ?? [],
    video_url:     h.video_url ?? null,
    source_url:    h.source_url ?? null,
    start_price:   h.starting_bid ?? null,
    url_horsetelex: h.url_horsetelex ?? null,
    url_extra:     h.url_extra ?? null,
  }
}

async function findOrCreateHouse(supabase, houseName, website) {
  const { data: found, error: fErr } = await supabase
    .from('auction_houses').select('*').eq('name', houseName).maybeSingle()
  if (fErr) throw new Error(`auction_houses zoeken: ${fErr.message}`)
  if (found) return found

  const { data, error } = await supabase
    .from('auction_houses').insert({ name: houseName, website }).select().single()
  if (error) throw new Error(`auction_houses aanmaken: ${error.message}`)
  return data
}

async function findOrCreateCollection(supabase, { houseName, website, name, date, location, status, notes }) {
  // Eerst zoeken op collectienaam over ALLE huizen heen — zo hergebruiken we
  // een bestaande veiling i.p.v. een duplicaat (+ duplicaat-huis) aan te maken.
  const { data: rows, error: fErr } = await supabase
    .from('collections').select('*').eq('name', name).limit(1)
  if (fErr) throw new Error(`collections zoeken: ${fErr.message}`)

  if (rows && rows[0]) {
    const existing = rows[0]
    // Alleen lege velden aanvullen — nooit bestaande data overschrijven.
    const patch = {}
    if (!existing.date && date) patch.date = date
    if (!existing.location && location) patch.location = location
    if (!existing.notes && notes) patch.notes = notes
    if (Object.keys(patch).length) {
      const { data, error } = await supabase
        .from('collections').update(patch).eq('id', existing.id).select().single()
      if (error) throw new Error(`collection bijwerken: ${error.message}`)
      return { collection: data, created: false }
    }
    return { collection: existing, created: false }
  }

  // Niets gevonden → nu pas een huis opzoeken/aanmaken en de collection maken.
  const house = await findOrCreateHouse(supabase, houseName, website)
  const { data, error } = await supabase
    .from('collections')
    .insert({ house_id: house.id, name, date, location, status, notes })
    .select().single()
  if (error) throw new Error(`collection aanmaken: ${error.message}`)
  return { collection: data, created: true }
}

/**
 * @param {object}  args
 * @param {object}  args.supabase   @supabase/supabase-js client
 * @param {string}  args.url        HORSE24 auction-detail-URL
 * @param {string}  [args.name]     collectienaam in onze app (default: gescrapete titel)
 * @param {string}  [args.house]    veilinghuis (default: 1e woord van name)
 * @param {string}  [args.location]
 * @param {string}  [args.date]     YYYY-MM-DD (default: gescrapete datum)
 * @param {string}  [args.status='planned']
 * @param {boolean} [args.enrich=true]
 * @param {(p:object)=>void} [args.onProgress]
 */
export async function importCollection(args) {
  const { supabase, url, status = 'planned', enrich = true, onProgress } = args
  if (!supabase) throw new Error('supabase-client ontbreekt')
  if (!url) throw new Error('url ontbreekt')

  onProgress?.({ phase: 'scrape', message: 'Bron herkennen…' })
  const source = await resolveSource(url)
  onProgress?.({ phase: 'scrape', message: `Bron: ${source.label} — collectie ophalen…` })
  const { meta, horses } = await source.scrape(url, {
    enrich,
    onProgress: p => onProgress?.({ phase: 'enrich', ...p }),
  })
  meta.source = source.id

  const name = (args.name && args.name.trim()) || meta.auction
  const houseName = (args.house && args.house.trim()) || name.split(' ')[0]
  const date = (args.date && args.date.trim()) || meta.date || null
  const location = args.location ?? ''
  const notes = [
    `bron: ${meta.source_url}`,
    meta.description ? `\n${meta.description}` : '',
  ].join('').trim()

  const { collection, created } = await findOrCreateCollection(supabase, {
    houseName, website: meta.website, name, date, location, status, notes,
  })

  // Huis van de (bestaande of nieuwe) collection ophalen voor het resultaat.
  const { data: house } = await supabase
    .from('auction_houses').select('*').eq('id', collection.house_id).maybeSingle()

  // lot_type_id is verplicht in `lots`. YoungSTARS = veulens → default 'foal'.
  const lotTypeKey = args.lotTypeKey || 'foal'
  const { data: types, error: tErr } = await supabase
    .from('lot_types').select('id, key')
  if (tErr) throw new Error(`lot_types ophalen: ${tErr.message}`)
  const lotTypeId = types.find(t => t.key === lotTypeKey)?.id
  if (!lotTypeId) throw new Error(`lot_type met key '${lotTypeKey}' niet gevonden`)

  // Bestaande lots ophalen (id per nummer).
  const { data: existing, error: exErr } = await supabase
    .from('lots').select('id, number').eq('collection_id', collection.id)
  if (exErr) throw new Error(`lots ophalen: ${exErr.message}`)
  const idByNumber = new Map((existing || []).map(l => [l.number, l.id]))

  const toInsert = horses
    .filter(h => !idByNumber.has(h.lot_number))
    .map(h => lotRow(collection.id, lotTypeId, h))

  let inserted = 0
  if (toInsert.length) {
    const { data, error: lErr } = await supabase
      .from('lots').insert(toInsert).select('id')
    if (lErr) throw new Error(`lots invoegen: ${lErr.message}`)
    inserted = data.length
  }

  // Optioneel: een veilige set scrape-velden bijwerken op BESTAANDE lots
  // (bv. ['pedigree','pedigree_raw','sire','dam']). Handmatige notities/
  // prijzen blijven ongemoeid omdat enkel deze kolommen worden geschreven.
  let updated = 0
  const fields = Array.isArray(args.updateExisting) ? args.updateExisting : []
  if (fields.length) {
    for (const h of horses) {
      const id = idByNumber.get(h.lot_number)
      if (!id) continue
      const full = lotRow(collection.id, lotTypeId, h)
      const patch = {}
      for (const f of fields) patch[f] = full[f]
      const { error } = await supabase.from('lots').update(patch).eq('id', id)
      if (error) throw new Error(`lot #${h.lot_number} bijwerken: ${error.message}`)
      updated++
    }
  }

  return {
    house: house || { name: houseName },
    collection,
    collection_created: created,
    meta,
    total: horses.length,
    inserted,
    updated,
    skipped: horses.length - inserted - updated,
  }
}
