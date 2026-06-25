// Helpers voor veilinghuizen: archiveren (zacht verbergen) en hard verwijderen.
//
// Archiveren = `auction_houses.archived = true` (migratie 0036); het huis blijft
// bestaan maar wordt in de UI standaard verborgen. Verwijderen is destructief en
// cascade-veilig: per collectie worden eerst alle afhankelijke rijen verwijderd
// (kinderen vóór ouder), exact in dezelfde volgorde als deleteCollection() in
// HousePage.jsx, en pas daarna het huis zelf.

import { supabase } from './supabase'

/** Zet de archived-vlag van een veilinghuis. */
export async function setHouseArchived(houseId, archived) {
  const { error } = await supabase
    .from('auction_houses')
    .update({ archived })
    .eq('id', houseId)
  if (error) throw new Error(error.message)
}

/** Zet de archived-vlag van een veiling (collectie). */
export async function setCollectionArchived(collectionId, archived) {
  const { error } = await supabase
    .from('collections')
    .update({ archived })
    .eq('id', collectionId)
  if (error) throw new Error(error.message)
}

/** Tel hoeveel collecties + lots onder een huis vallen (voor de bevestiging). */
export async function getHouseContents(houseId) {
  const { data: cols, error: cErr } = await supabase
    .from('collections').select('id').eq('house_id', houseId)
  if (cErr) throw new Error(cErr.message)
  const ids = (cols ?? []).map((c) => c.id)
  let lotCount = 0
  if (ids.length) {
    const { count } = await supabase
      .from('lots').select('id', { count: 'exact', head: true }).in('collection_id', ids)
    lotCount = count ?? 0
  }
  return { collectionCount: ids.length, lotCount, collectionIds: ids }
}

/** Verwijder één collectie + al haar afhankelijke rijen (FK-veilige volgorde). */
async function deleteCollectionCascade(collectionId) {
  const step = async (label, p) => {
    const { error } = await p
    if (error) throw new Error(`${label}: ${error.message}`)
  }
  const { data: lots, error: lErr } = await supabase
    .from('lots').select('id').eq('collection_id', collectionId)
  if (lErr) throw new Error(`lots ophalen: ${lErr.message}`)
  const lotIds = (lots ?? []).map((l) => l.id)

  // actief lot loskoppelen zodat de FK collections.active_lot_id de lot-delete niet blokkeert
  await step('actief lot loskoppelen',
    supabase.from('collections').update({ active_lot_id: null }).eq('id', collectionId))
  if (lotIds.length) {
    await step('klant-koppelingen',
      supabase.from('lot_interested_clients').delete().in('lot_id', lotIds))
  }
  await step('biedstappen',     supabase.from('bid_step_rules').delete().eq('collection_id', collectionId))
  await step('lot-types',       supabase.from('collection_lot_types').delete().eq('collection_id', collectionId))
  await step('pauzes',          supabase.from('collection_breaks').delete().eq('collection_id', collectionId))
  await step('spotters',        supabase.from('collection_spotters').delete().eq('collection_id', collectionId))
  await step('zaalindeling',    supabase.from('client_collection_seating').delete().eq('collection_id', collectionId))
  await step('lots',            supabase.from('lots').delete().eq('collection_id', collectionId))
  await step('veiling',         supabase.from('collections').delete().eq('id', collectionId))
}

/**
 * Verwijder een veilinghuis inclusief al zijn collecties en lots. Destructief en
 * onomkeerbaar. Eén fout stopt de hele actie (geen half-verwijderde toestand).
 */
export async function deleteHouse(houseId) {
  const { data: cols, error: cErr } = await supabase
    .from('collections').select('id').eq('house_id', houseId)
  if (cErr) throw new Error(`collecties ophalen: ${cErr.message}`)
  for (const c of cols ?? []) {
    await deleteCollectionCascade(c.id)
  }
  // Comitéleden (house_committee_members) hebben FK met ON DELETE CASCADE →
  // verdwijnen automatisch wanneer het huis verwijderd wordt.
  const { error } = await supabase.from('auction_houses').delete().eq('id', houseId)
  if (error) throw new Error(`huis verwijderen: ${error.message}`)
}
