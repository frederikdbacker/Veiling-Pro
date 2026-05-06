import { supabase } from './supabase'

/**
 * Database-helpers voor klanten-CRM.
 *
 * Klanten horen bij een veilinghuis (clients.house_id). Tafel/richting/
 * opmerking horen per (klant, veiling) en zitten in client_auction_seating.
 * Koppeling klant ↔ paard zit in lot_interested_clients.
 * Koper van een verkocht paard zit in lots.buyer_client_id.
 */

/** Zoek klanten van een specifiek huis waarvan de naam met `query` start. */
export async function searchClientsInHouse(houseId, query) {
  if (!houseId || !query || query.trim().length < 1) return []
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, country_code')
    .eq('house_id', houseId)
    .ilike('name', `${query.trim()}%`)
    .order('name')
    .limit(10)
  if (error) {
    console.error('searchClientsInHouse:', error)
    return []
  }
  return data ?? []
}

/**
 * Maak een nieuwe klant aan voor het opgegeven huis. Gebruikt door de UI
 * wanneer de gebruiker bewust een nieuwe naam intypt (geen autocomplete-
 * suggestie aangeklikt).
 *
 * Bewust GEEN deduplicatie op exacte naam: één huis kan twee mensen met
 * dezelfde naam hebben. De UI dedupliceert via autocomplete-suggesties.
 */
export async function createClient(houseId, name, fields = {}) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Naam mag niet leeg zijn')
  if (!houseId) throw new Error('Veilinghuis-id ontbreekt')
  const payload = { name: trimmed, house_id: houseId }
  if (fields.country_code !== undefined) payload.country_code = fields.country_code || null
  const { data, error } = await supabase
    .from('clients')
    .insert(payload)
    .select('id, name, country_code')
    .single()
  if (error) throw error
  return data
}

/** Generiek update — partial patch op clients-row. Gebruik voor naam, country_code, etc. */
export async function updateClient(clientId, patch) {
  const cleaned = {}
  if ('name' in patch) {
    const trimmed = (patch.name ?? '').trim()
    if (!trimmed) throw new Error('Naam mag niet leeg zijn')
    cleaned.name = trimmed
  }
  if ('country_code' in patch) cleaned.country_code = patch.country_code || null
  if (Object.keys(cleaned).length === 0) return
  const { error } = await supabase.from('clients').update(cleaned).eq('id', clientId)
  if (error) throw error
}

/** Haal de seating-row voor (klant, veiling). Geeft null als er nog niets staat. */
export async function getSeating(clientId, collectionId) {
  const { data, error } = await supabase
    .from('client_collection_seating')
    .select('table_number, direction, notes, bidding_mode')
    .eq('client_id', clientId)
    .eq('collection_id', collectionId)
    .maybeSingle()
  if (error) {
    console.error('getSeating:', error)
    return null
  }
  return data
}

/** Insert of update tafel/richting/opmerking + bidding_mode voor (klant, veiling). */
export async function upsertSeating(clientId, collectionId, fields) {
  const payload = {
    client_id: clientId,
    collection_id: collectionId,
    table_number: fields.table_number?.trim() || null,
    direction:    fields.direction?.trim()    || null,
    notes:        fields.notes?.trim()        || null,
  }
  if (fields.bidding_mode) payload.bidding_mode = fields.bidding_mode
  const { error } = await supabase
    .from('client_collection_seating')
    .upsert(payload, { onConflict: 'client_id,collection_id' })
  if (error) throw error
}

/** Koppel een klant aan een lot (geïnteresseerden-lijst). */
export async function linkClientToLot(clientId, lotId, lotSpecificNotes = null) {
  const { error } = await supabase
    .from('lot_interested_clients')
    .insert({
      client_id: clientId,
      lot_id:    lotId,
      notes:     lotSpecificNotes?.trim() || null,
    })
  if (error) throw error
}

/** Update de naam van een bestaande klant (bv. typfout corrigeren). */
export async function updateClientName(clientId, name) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Naam mag niet leeg zijn')
  const { error } = await supabase
    .from('clients')
    .update({ name: trimmed })
    .eq('id', clientId)
  if (error) throw error
}

/** Update de paard-specifieke notitie voor (klant, lot). */
export async function updateLotInterestedNotes(clientId, lotId, notes) {
  const { error } = await supabase
    .from('lot_interested_clients')
    .update({ notes: notes?.trim() || null })
    .eq('client_id', clientId)
    .eq('lot_id', lotId)
  if (error) throw error
}

/** Verwijder de koppeling klant ↔ lot. De klant zelf blijft staan. */
export async function unlinkClientFromLot(clientId, lotId) {
  const { error } = await supabase
    .from('lot_interested_clients')
    .delete()
    .eq('client_id', clientId)
    .eq('lot_id', lotId)
  if (error) throw error
}

/**
 * Geef alle geïnteresseerde klanten voor een lot, verrijkt met seating-info
 * (tafelnummer/richting/opmerking) uit dezelfde veiling.
 *
 * Twee queries i.p.v. één geneste embed-query: PostgREST ondersteunt geen
 * direct-filter op embedded relations met where-clauses voor onze
 * specifieke vorm.
 */
export async function getInterestedClientsForLot(lotId, collectionId) {
  const { data: rows, error } = await supabase
    .from('lot_interested_clients')
    .select('notes, clients(id, name, house_id, country_code)')
    .eq('lot_id', lotId)
  if (error) { console.error('getInterestedClientsForLot:', error); return [] }
  if (!rows || rows.length === 0) return []

  const clientIds = rows.map((r) => r.clients.id)
  const { data: seatings } = await supabase
    .from('client_collection_seating')
    .select('client_id, table_number, direction, notes, bidding_mode')
    .eq('collection_id', collectionId)
    .in('client_id', clientIds)

  const seatingMap = new Map((seatings ?? []).map((s) => [s.client_id, s]))

  return rows.map((r) => {
    const seating = seatingMap.get(r.clients.id)
    return {
      client_id:     r.clients.id,
      name:          r.clients.name,
      country_code:  r.clients.country_code ?? null,
      lot_notes:     r.notes,
      table_number:  seating?.table_number ?? null,
      direction:     seating?.direction ?? null,
      seating_notes: seating?.notes ?? null,
      bidding_mode:  seating?.bidding_mode ?? 'onsite',
    }
  })
}

/**
 * Geef per klant-id de lijst van lots die hij/zij heeft gekocht binnen
 * deze veiling. Voor de "✓ al gekocht: #5"-indicator op LotPage / cockpit.
 */
export async function getPurchasesByClientsInAuction(collectionId, clientIds) {
  if (!clientIds || clientIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('lots')
    .select('id, number, name, buyer_client_id')
    .eq('collection_id', collectionId)
    .eq('sold', true)
    .in('buyer_client_id', clientIds)
  if (error) { console.error('getPurchasesByClientsInAuction:', error); return new Map() }

  const map = new Map()
  for (const lot of data ?? []) {
    if (!map.has(lot.buyer_client_id)) map.set(lot.buyer_client_id, [])
    map.get(lot.buyer_client_id).push({
      id: lot.id, number: lot.number, name: lot.name,
    })
  }
  return map
}
