import { supabase } from './supabase'

/**
 * Database-helpers voor comité-leden per veilinghuis (#0024).
 */

export async function getMembers(houseId) {
  if (!houseId) return []
  const { data, error } = await supabase
    .from('house_committee_members')
    .select('*')
    .eq('house_id', houseId)
    .order('display_order')
    .order('name')
  if (error) { console.error('getMembers:', error); return [] }
  return data ?? []
}

export async function createMember(houseId, fields = {}) {
  if (!houseId) throw new Error('Veilinghuis-id ontbreekt')
  const trimmed = (fields.name ?? '').trim()
  if (!trimmed) throw new Error('Naam mag niet leeg zijn')
  const payload = {
    house_id: houseId,
    name: trimmed,
    role: fields.role?.trim() || null,
    year_joined: fields.year_joined ?? null,
    year_left: fields.year_left ?? null,
    display_order: fields.display_order ?? 0,
  }
  const { data, error } = await supabase
    .from('house_committee_members')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMember(memberId, patch) {
  const cleaned = {}
  if ('name' in patch) {
    const t = (patch.name ?? '').trim()
    if (!t) throw new Error('Naam mag niet leeg zijn')
    cleaned.name = t
  }
  if ('role' in patch)          cleaned.role          = patch.role?.trim?.() || null
  if ('year_joined' in patch)   cleaned.year_joined   = patch.year_joined === '' ? null : patch.year_joined
  if ('year_left' in patch)     cleaned.year_left     = patch.year_left === '' ? null : patch.year_left
  if ('photo_url' in patch)     cleaned.photo_url     = patch.photo_url || null
  if ('display_order' in patch) cleaned.display_order = patch.display_order
  if (Object.keys(cleaned).length === 0) return
  const { error } = await supabase
    .from('house_committee_members')
    .update(cleaned)
    .eq('id', memberId)
  if (error) throw error
}

export async function deleteMember(memberId) {
  const { error } = await supabase
    .from('house_committee_members')
    .delete()
    .eq('id', memberId)
  if (error) throw error
}
