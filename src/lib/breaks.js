import { supabase } from './supabase'

/**
 * Database-helpers voor pauzes (auction_breaks) tussen lots.
 * Een pauze staat "na lot N" via after_lot_number; UI rendert
 * automatisch een BIS-label "${N} BIS".
 */

export async function getBreaks(collectionId) {
  if (!collectionId) return []
  const { data, error } = await supabase
    .from('collection_breaks')
    .select('*')
    .eq('collection_id', collectionId)
    .order('after_lot_number', { nullsFirst: true })
    .order('created_at')
  if (error) { console.error('getBreaks:', error); return [] }
  return data ?? []
}

export async function createBreak(collectionId, fields = {}) {
  const { data, error } = await supabase
    .from('collection_breaks')
    .insert({
      collection_id:       collectionId,
      after_lot_number: fields.after_lot_number ?? null,
      title:            fields.title?.trim() || 'Pauze',
      description:      fields.description?.trim() || null,
      duration_minutes: fields.duration_minutes ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBreak(id, patch) {
  const cleaned = {}
  if ('after_lot_number' in patch) cleaned.after_lot_number = patch.after_lot_number ?? null
  if ('title' in patch)            cleaned.title            = patch.title?.trim() || 'Pauze'
  if ('description' in patch)      cleaned.description      = patch.description?.trim() || null
  if ('duration_minutes' in patch) cleaned.duration_minutes = patch.duration_minutes ?? null
  const { error } = await supabase.from('collection_breaks').update(cleaned).eq('id', id)
  if (error) throw error
}

export async function deleteBreak(id) {
  const { error } = await supabase.from('collection_breaks').delete().eq('id', id)
  if (error) throw error
}
