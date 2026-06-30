import { supabase } from './supabase'

/**
 * Database-helpers voor spotters.
 *
 * Spotters zijn globaal (per migratie 0010): één spotter kan voor
 * meerdere veilinghuizen / veilingen werken. De koppeling spotter ↔
 * veiling zit in `auction_spotters` (junction) en draagt de per-veiling
 * specifieke velden `location` en `display_order`.
 */

/**
 * Geef alle spotter-toewijzingen van deze veiling, gesorteerd.
 *
 * Sinds migratie 0038 draagt elke rij een eigen `assignment_id` (surrogaat-PK)
 * en een `collection_day_id` (null = "alle dagen", anders een specifieke
 * veilingdag). Eén spotter kan dus meerdere rijen hebben (één per dag).
 */
export async function getSpotters(collectionId) {
  if (!collectionId) return []
  const { data, error } = await supabase
    .from('collection_spotters')
    .select(`
      id, location, display_order, collection_day_id,
      spotters!inner ( id, name, photo_url, notes )
    `)
    .eq('collection_id', collectionId)
    .order('display_order')
  if (error) { console.error('getSpotters:', error); return [] }
  return (data ?? []).map((row) => ({
    assignment_id:     row.id,
    id:                row.spotters.id,
    name:              row.spotters.name,
    photo_url:         row.spotters.photo_url,
    notes:             row.spotters.notes,
    location:          row.location,
    display_order:     row.display_order,
    collection_day_id: row.collection_day_id,
  }))
}

/**
 * Effectieve spotters voor één veilingdag (voor de cockpit). Een spotter telt
 * mee als hij een dag-rij voor deze dag heeft OF een "alle dagen"-rij (null).
 * Een dag-specifieke rij wint van de "alle dagen"-rij (dedupe per spotter).
 * Zonder dayId (legacy/eendaags): geef gewoon alle rijen.
 */
export async function getSpottersForDay(collectionId, dayId) {
  const all = await getSpotters(collectionId)
  if (!dayId) return all
  const bySpotter = new Map()
  for (const s of all) {
    if (s.collection_day_id !== null && s.collection_day_id !== dayId) continue
    const existing = bySpotter.get(s.id)
    // dag-specifiek wint van "alle dagen"
    if (!existing || (existing.collection_day_id === null && s.collection_day_id === dayId)) {
      bySpotter.set(s.id, s)
    }
  }
  return [...bySpotter.values()].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
}

/** Zoek globale spotters waarvan de naam met `query` start. */
export async function searchSpotters(query) {
  if (!query || query.trim().length < 1) return []
  const { data, error } = await supabase
    .from('spotters')
    .select('id, name, photo_url')
    .ilike('name', `${query.trim()}%`)
    .order('name')
    .limit(10)
  if (error) { console.error('searchSpotters:', error); return [] }
  return data ?? []
}

/** Maak een nieuwe globale spotter aan. */
export async function createSpotter({ name, photo_url = null, notes = null }) {
  const trimmed = name?.trim()
  if (!trimmed) throw new Error('Naam mag niet leeg zijn')
  const { data, error } = await supabase
    .from('spotters')
    .insert({
      name: trimmed,
      photo_url: photo_url?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Update een globale spotter (naam/foto/notes — geldt voor alle veilingen). */
export async function updateSpotter(id, patch) {
  const cleaned = {}
  for (const k of ['name', 'photo_url', 'notes']) {
    if (k in patch) cleaned[k] = patch[k]?.trim?.() || null
  }
  const { error } = await supabase.from('spotters').update(cleaned).eq('id', id)
  if (error) throw error
}

/**
 * Wijs een spotter toe aan een veiling met locatie en positie.
 * `collection_day_id` (optioneel): null = "alle dagen" (default), anders een
 * specifieke veilingdag.
 */
export async function assignSpotter(collectionId, spotterId, fields = {}) {
  const { error } = await supabase
    .from('collection_spotters')
    .insert({
      collection_id:     collectionId,
      spotter_id:        spotterId,
      location:          fields.location?.trim() || null,
      display_order:     fields.display_order ?? 0,
      collection_day_id: fields.collection_day_id ?? null,
    })
  if (error) throw error
}

/** Verwijder de toewijzing — globale spotter blijft staan voor andere veilingen. */
export async function unassignSpotter(collectionId, spotterId) {
  const { error } = await supabase
    .from('collection_spotters')
    .delete()
    .match({ collection_id: collectionId, spotter_id: spotterId })
  if (error) throw error
}

/** Update junction-velden (location, display_order) van een toewijzing. */
export async function updateAssignment(collectionId, spotterId, patch) {
  const cleaned = {}
  if ('location' in patch) cleaned.location = patch.location?.trim?.() || null
  if ('display_order' in patch) cleaned.display_order = patch.display_order
  const { error } = await supabase
    .from('collection_spotters')
    .update(cleaned)
    .match({ collection_id: collectionId, spotter_id: spotterId })
  if (error) throw error
}

/** Wissel display_order tussen twee assignments (voor ↑/↓-knoppen). */
export async function swapOrder(collectionId, spotterA, spotterB) {
  const orderA = spotterA.display_order
  const orderB = spotterB.display_order
  await updateAssignment(collectionId, spotterA.id, { display_order: orderB })
  await updateAssignment(collectionId, spotterB.id, { display_order: orderA })
}

/**
 * Globale spotterspool met per spotter de veilinghuizen waar hij ooit aan een
 * collectie hing (afgeleid uit historie — geen aparte tabel). Voor de
 * spotterspool-pagina (B1) en haar huisfilter.
 *
 * Retour: [{ id, name, photo_url, notes, houses: [{ id, name }] }]
 * Spotters zonder historie horen bij géén huis (houses: []).
 */
export async function listSpottersWithHouses() {
  const [spottersRes, junctionRes] = await Promise.all([
    supabase.from('spotters').select('id, name, photo_url, notes').order('name'),
    supabase
      .from('collection_spotters')
      .select('spotter_id, collections ( house_id, auction_houses ( id, name ) )'),
  ])
  if (spottersRes.error) { console.error('listSpottersWithHouses spotters:', spottersRes.error); return [] }
  if (junctionRes.error) { console.error('listSpottersWithHouses junction:', junctionRes.error) }

  // Per spotter de unieke set huizen verzamelen
  const housesBySpotter = new Map()
  for (const row of junctionRes.data ?? []) {
    const house = row.collections?.auction_houses
    if (!house?.id) continue
    if (!housesBySpotter.has(row.spotter_id)) housesBySpotter.set(row.spotter_id, new Map())
    housesBySpotter.get(row.spotter_id).set(house.id, house.name)
  }

  return (spottersRes.data ?? []).map((s) => ({
    ...s,
    houses: housesBySpotter.has(s.id)
      ? [...housesBySpotter.get(s.id)].map(([id, name]) => ({ id, name }))
      : [],
  }))
}

/**
 * Wijs meerdere spotters in één keer toe aan een collectie (B1).
 * Al-toegewezen spotters worden overgeslagen (geen dubbele rij / PK-conflict).
 * Nieuwe toewijzingen krijgen oplopende display_order ná de bestaande.
 * Retour: aantal effectief toegevoegde spotters.
 */
export async function assignSpottersToCollection(collectionId, spotterIds) {
  if (!collectionId || !spotterIds?.length) return 0
  const { data: existing, error } = await supabase
    .from('collection_spotters')
    .select('spotter_id, display_order')
    .eq('collection_id', collectionId)
  if (error) throw error

  const already = new Set((existing ?? []).map((r) => r.spotter_id))
  let order = (existing ?? []).reduce((m, r) => Math.max(m, r.display_order ?? 0), -1) + 1

  const toAdd = spotterIds.filter((id) => !already.has(id))
  for (const spotterId of toAdd) {
    await assignSpotter(collectionId, spotterId, { display_order: order })
    order += 1
  }
  return toAdd.length
}

/* ---------- Dag-bewuste helpers (B2, migratie 0038) ---------- */

/**
 * Wijs een spotter toe aan één specifieke veilingdag. Bepaalt zelf de volgende
 * display_order binnen die dag. `dayId` null = "alle dagen".
 */
export async function assignSpotterToDay(collectionId, spotterId, dayId, fields = {}) {
  let q = supabase
    .from('collection_spotters')
    .select('display_order')
    .eq('collection_id', collectionId)
  q = dayId == null ? q.is('collection_day_id', null) : q.eq('collection_day_id', dayId)
  const { data } = await q
  const order = (data ?? []).reduce((m, r) => Math.max(m, r.display_order ?? 0), -1) + 1
  await assignSpotter(collectionId, spotterId, {
    ...fields, display_order: order, collection_day_id: dayId,
  })
}

/**
 * Verwijder een spotter van één veilingdag — altijd representeerbaar, ook als
 * hij nog op een "alle dagen"-rij (null) staat:
 *   1. Bestaat er een dag-specifieke rij voor deze dag → wis enkel die.
 *   2. Geen dag-rij maar wel een "alle dagen"-rij → waaier die uit naar echte
 *      dag-rijen voor alle ándere dagen en wis de null-rij. Zo verdwijnt de
 *      spotter van déze dag en blijft hij op de rest, zonder onverwijderbare
 *      null-rij.
 *   3. Stond niet op die dag → niets te doen.
 * `allDayIds` = alle veilingdag-id's van de collectie.
 */
export async function removeSpotterFromDay(collectionId, spotterId, dayId, allDayIds = []) {
  const { data: dayRow } = await supabase
    .from('collection_spotters')
    .select('id')
    .eq('collection_id', collectionId)
    .eq('spotter_id', spotterId)
    .eq('collection_day_id', dayId)
    .maybeSingle()
  if (dayRow) {
    const { error } = await supabase.from('collection_spotters').delete().eq('id', dayRow.id)
    if (error) throw error
    return
  }

  const { data: allRow } = await supabase
    .from('collection_spotters')
    .select('id, location')
    .eq('collection_id', collectionId)
    .eq('spotter_id', spotterId)
    .is('collection_day_id', null)
    .maybeSingle()
  if (allRow) {
    for (const d of allDayIds.filter((x) => x !== dayId)) {
      await assignSpotterToDay(collectionId, spotterId, d, { location: allRow.location })
    }
    const { error } = await supabase.from('collection_spotters').delete().eq('id', allRow.id)
    if (error) throw error
  }
}

/**
 * "Naar alle dagen": schrijf voor de spotter een echte rij per veilingdag weg
 * (dagen waar hij al staat overgeslagen). Een eventuele "alle dagen"-rij (null)
 * wordt uitgewaaierd en daarna verwijderd, zodat er geen lingerende null-rij
 * naast dag-rijen blijft staan.
 */
export async function copySpotterToAllDays(collectionId, spotterId, dayIds = []) {
  const { data: existing } = await supabase
    .from('collection_spotters')
    .select('id, collection_day_id, location')
    .eq('collection_id', collectionId)
    .eq('spotter_id', spotterId)
  const rows = existing ?? []
  const nullRow = rows.find((r) => r.collection_day_id === null)
  const location = rows.find((r) => r.location)?.location ?? null
  const have = new Set(rows.filter((r) => r.collection_day_id !== null).map((r) => r.collection_day_id))

  for (const d of dayIds) {
    if (have.has(d)) continue
    await assignSpotterToDay(collectionId, spotterId, d, { location })
  }
  if (nullRow) {
    const { error } = await supabase.from('collection_spotters').delete().eq('id', nullRow.id)
    if (error) throw error
  }
}

/** Update een toewijzing op rij-id (location / display_order). */
export async function updateAssignmentById(assignmentId, patch) {
  const cleaned = {}
  if ('location' in patch) cleaned.location = patch.location?.trim?.() || null
  if ('display_order' in patch) cleaned.display_order = patch.display_order
  const { error } = await supabase
    .from('collection_spotters')
    .update(cleaned)
    .eq('id', assignmentId)
  if (error) throw error
}

/** Wissel display_order tussen twee toewijzingen (op rij-id) — voor ↑/↓. */
export async function swapOrderById(rowA, rowB) {
  await updateAssignmentById(rowA.assignment_id, { display_order: rowB.display_order })
  await updateAssignmentById(rowB.assignment_id, { display_order: rowA.display_order })
}
