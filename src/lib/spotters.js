import { supabase } from './supabase'

/**
 * Database-helpers voor spotters per veiling.
 * Spotters worden gesorteerd op display_order (laag = meer links) zodat
 * de cockpit-strip ze in de juiste volgorde van links naar rechts toont.
 */

export async function getSpotters(auctionId) {
  if (!auctionId) return []
  const { data, error } = await supabase
    .from('spotters')
    .select('*')
    .eq('auction_id', auctionId)
    .order('display_order')
    .order('created_at')
  if (error) { console.error('getSpotters:', error); return [] }
  return data ?? []
}

export async function createSpotter(auctionId, fields = {}) {
  // Bepaal hoogste display_order; nieuwe spotter komt aan het eind (rechts)
  const { data: existing } = await supabase
    .from('spotters')
    .select('display_order')
    .eq('auction_id', auctionId)
    .order('display_order', { ascending: false })
    .limit(1)
  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1

  const { data, error } = await supabase
    .from('spotters')
    .insert({
      auction_id:    auctionId,
      name:          fields.name?.trim() || 'Nieuwe spotter',
      location:      fields.location?.trim() || null,
      photo_url:     fields.photo_url?.trim() || null,
      display_order: nextOrder,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSpotter(id, patch) {
  // Trim string-velden, laat null doorstromen
  const cleaned = {}
  for (const k of ['name', 'location', 'photo_url']) {
    if (k in patch) cleaned[k] = patch[k]?.trim?.() || null
  }
  if ('display_order' in patch) cleaned.display_order = patch.display_order
  const { error } = await supabase.from('spotters').update(cleaned).eq('id', id)
  if (error) throw error
}

export async function deleteSpotter(id) {
  const { error } = await supabase.from('spotters').delete().eq('id', id)
  if (error) throw error
}

/** Wissel display_order tussen twee spotters (voor ↑/↓-knoppen). */
export async function swapOrder(spotterA, spotterB) {
  const orderA = spotterA.display_order
  const orderB = spotterB.display_order
  // Twee aparte updates — Supabase REST kan geen multi-row update in één call
  await updateSpotter(spotterA.id, { display_order: orderB })
  await updateSpotter(spotterB.id, { display_order: orderA })
}
