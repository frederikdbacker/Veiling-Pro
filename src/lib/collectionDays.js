import { supabase } from './supabase'

/**
 * Database-helpers voor veilingdagen (collection_days) — migratie 0031.
 *
 * Een collectie (de hele binnengehaalde verkoop) kan over meerdere
 * veilingdagen verkocht worden. Elke dag is een aparte live-sessie met een
 * eigen actief lot, eigen sessietiming en eigen status. Lots hangen via
 * `lots.collection_day_id` aan een dag; nullable = "nog niet toegewezen".
 *
 * Wat collectie-breed blijft (spotters, biedstaffels, lot-types,
 * klanten/seating) zit NIET hier — zie spotters.js / breaks.js / clients.js.
 *
 * Volgt het CRUD-patroon van breaks.js / spotters.js.
 */

/** Alle veilingdagen van een collectie, gesorteerd op day_index. */
export async function getDays(collectionId) {
  if (!collectionId) return []
  const { data, error } = await supabase
    .from('collection_days')
    .select('*')
    .eq('collection_id', collectionId)
    .order('day_index')
  if (error) { console.error('getDays:', error); return [] }
  return data ?? []
}

/**
 * Maak een nieuwe veilingdag aan. day_index wordt automatisch bepaald
 * (hoogste bestaande + 1, of 1 als er nog geen dagen zijn).
 */
export async function createDay(collectionId, fields = {}) {
  if (!collectionId) throw new Error('collectionId ontbreekt')
  const existing = await getDays(collectionId)
  const nextIndex = existing.reduce((m, d) => Math.max(m, d.day_index ?? 0), 0) + 1
  const { data, error } = await supabase
    .from('collection_days')
    .insert({
      collection_id: collectionId,
      day_index:     nextIndex,
      date:          fields.date || null,
      label:         fields.label?.trim() || null,
      status:        fields.status?.trim() || 'planned',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Update dag-velden (label, date, status, sessietiming). */
export async function updateDay(id, patch) {
  const cleaned = {}
  if ('label' in patch)              cleaned.label = patch.label?.trim() || null
  if ('date' in patch)               cleaned.date = patch.date || null
  if ('status' in patch)             cleaned.status = patch.status?.trim() || 'planned'
  if ('day_index' in patch)          cleaned.day_index = patch.day_index
  if ('time_session_start' in patch) cleaned.time_session_start = patch.time_session_start || null
  if ('time_session_end' in patch)   cleaned.time_session_end = patch.time_session_end || null
  const { error } = await supabase.from('collection_days').update(cleaned).eq('id', id)
  if (error) throw error
}

/**
 * Verwijder een veilingdag. Geblokkeerd als er nog lots aan hangen — eerst
 * herverdelen (geen cascade-verlies van lots). Geeft een duidelijke fout.
 */
export async function deleteDay(id) {
  const { count, error: countErr } = await supabase
    .from('lots')
    .select('id', { count: 'exact', head: true })
    .eq('collection_day_id', id)
  if (countErr) throw countErr
  if ((count ?? 0) > 0) {
    throw new Error(
      `Deze dag bevat nog ${count} lot${count > 1 ? 's' : ''}. ` +
      `Verplaats die eerst naar een andere dag of naar "Niet toegewezen".`
    )
  }
  const { error } = await supabase.from('collection_days').delete().eq('id', id)
  if (error) throw error
}

/** Wijs één lot toe aan een dag (of null = terug naar "Niet toegewezen"). */
export async function assignLotToDay(lotId, dayId) {
  const { error } = await supabase
    .from('lots')
    .update({ collection_day_id: dayId || null })
    .eq('id', lotId)
  if (error) throw error
}

/** Wijs meerdere lots in één keer toe aan een dag (of null). */
export async function bulkAssignLotsToDay(lotIds, dayId) {
  if (!Array.isArray(lotIds) || lotIds.length === 0) return
  const { error } = await supabase
    .from('lots')
    .update({ collection_day_id: dayId || null })
    .in('id', lotIds)
  if (error) throw error
}

/**
 * Bulk-helper "lots #A–#B → dag X": wijs alle lots van deze collectie met
 * catalogusnummer in [fromNumber, toNumber] toe aan een dag. Snel voor
 * verkopen waar een aaneengesloten lotnummerbereik met een dag samenvalt.
 */
export async function assignLotsByNumberRange(collectionId, fromNumber, toNumber, dayId) {
  const lo = Math.min(fromNumber, toNumber)
  const hi = Math.max(fromNumber, toNumber)
  const { data, error } = await supabase
    .from('lots')
    .update({ collection_day_id: dayId || null })
    .eq('collection_id', collectionId)
    .gte('number', lo)
    .lte('number', hi)
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

/**
 * Zet (of wis) het actieve lot van een veilingdag. Vervangt het oude
 * collections.active_lot_id — de live-sessie draait nu per dag.
 */
export async function setActiveLotForDay(dayId, lotId) {
  if (!dayId) return
  const { error } = await supabase
    .from('collection_days')
    .update({ active_lot_id: lotId || null })
    .eq('id', dayId)
  if (error) throw error
}
