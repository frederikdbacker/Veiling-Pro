import { supabase } from './supabase'

/**
 * Database-helpers voor spotters.
 *
 * Spotters zijn globaal (per migratie 0010): één spotter kan voor
 * meerdere veilinghuizen / veilingen werken. De koppeling spotter ↔
 * veiling zit in `auction_spotters` (junction) en draagt de per-veiling
 * specifieke velden `location` en `display_order`.
 */

/** Geef alle spotters die toegewezen zijn aan deze veiling, gesorteerd. */
export async function getSpotters(auctionId) {
  if (!auctionId) return []
  const { data, error } = await supabase
    .from('collection_spotters')
    .select(`
      location, display_order,
      spotters!inner ( id, name, photo_url, notes )
    `)
    .eq('collection_id', auctionId)
    .order('display_order')
  if (error) { console.error('getSpotters:', error); return [] }
  return (data ?? []).map((row) => ({
    id:            row.spotters.id,
    name:          row.spotters.name,
    photo_url:     row.spotters.photo_url,
    notes:         row.spotters.notes,
    location:      row.location,
    display_order: row.display_order,
  }))
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

/** Wijs een spotter toe aan een veiling met locatie en positie. */
export async function assignSpotter(auctionId, spotterId, fields = {}) {
  const { error } = await supabase
    .from('collection_spotters')
    .insert({
      collection_id:    auctionId,
      spotter_id:    spotterId,
      location:      fields.location?.trim() || null,
      display_order: fields.display_order ?? 0,
    })
  if (error) throw error
}

/** Verwijder de toewijzing — globale spotter blijft staan voor andere veilingen. */
export async function unassignSpotter(auctionId, spotterId) {
  const { error } = await supabase
    .from('collection_spotters')
    .delete()
    .match({ collection_id: auctionId, spotter_id: spotterId })
  if (error) throw error
}

/** Update junction-velden (location, display_order) van een toewijzing. */
export async function updateAssignment(auctionId, spotterId, patch) {
  const cleaned = {}
  if ('location' in patch) cleaned.location = patch.location?.trim?.() || null
  if ('display_order' in patch) cleaned.display_order = patch.display_order
  const { error } = await supabase
    .from('collection_spotters')
    .update(cleaned)
    .match({ collection_id: auctionId, spotter_id: spotterId })
  if (error) throw error
}

/** Wissel display_order tussen twee assignments (voor ↑/↓-knoppen). */
export async function swapOrder(auctionId, spotterA, spotterB) {
  const orderA = spotterA.display_order
  const orderB = spotterB.display_order
  await updateAssignment(auctionId, spotterA.id, { display_order: orderB })
  await updateAssignment(auctionId, spotterB.id, { display_order: orderA })
}
