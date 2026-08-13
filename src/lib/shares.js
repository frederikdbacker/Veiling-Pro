import { supabase } from './supabase'

// ============================================================
// shares — beheer van niet-raadbare deellinks voor het eindoverzicht.
//
// Een deellink verwijst NIET naar de interne route /collections/<uuid>/summary
// (die verraadt de app-structuur en hangt achter de login), maar naar de
// publieke, kale route /gedeeld/<token>. Het token is lang en willekeurig en
// staat los van elke interne id.
//
// GEEN DIRECTE TABELTOEGANG MEER (migratie 0041, 13-08-2026).
// De tabel collection_shares had tot 0041 dezelfde alles-open policy als de
// rest van het schema. Gemeten gevolg: met de publieke sleutel kon iedereen
// alle tokens uitlezen, een eigen token invoegen, en een ingetrokken link weer
// activeren door revoked_at op null te zetten. Die policy is weg; RLS staat aan
// zonder policy, dus de tabel is rechtstreeks onbereikbaar.
//
// Alle vier de paden lopen nu via SECURITY DEFINER-functies:
//   get_or_create_collection_share()  aanmaken of hergebruiken
//   list_collection_shares()          lijst voor het beheerscherm
//   revoke_collection_share()         intrekken (zet enkel, wist nooit)
//   get_shared_collection_summary()   lezen door de ontvanger (0039)
// ============================================================

/** De volledige, deelbare URL voor een token. */
export function shareUrl(token) {
  return `${window.location.origin}/gedeeld/${token}`
}

/**
 * Geef een bestaande actieve deellink voor de collectie terug, of maak er een.
 * "Actief" = niet ingetrokken en niet verlopen. Zo krijgt Frederik bij herhaald
 * klikken telkens dezelfde link i.p.v. een wildgroei aan tokens.
 *
 * Het token wordt SERVER-SIDE gegenereerd (64 hex-tekens). De browser levert
 * geen tokenwaarde meer aan — niemand kan dus een zelfgekozen of vooraf bekend
 * token laten opslaan.
 *
 * @returns {Promise<{ token: string, url: string, reused: boolean }>}
 */
export async function getOrCreateShare(collectionId) {
  const { data, error } = await supabase.rpc('get_or_create_collection_share', {
    p_collection_id: collectionId,
  })
  if (error) throw new Error(error.message)
  if (!data?.token) throw new Error('Geen deellink ontvangen van de server.')

  return { token: data.token, url: shareUrl(data.token), reused: !!data.reused }
}

/** Alle deellinks voor een collectie (nieuwste eerst), voor het beheer-overzicht. */
export async function listShares(collectionId) {
  const { data, error } = await supabase.rpc('list_collection_shares', {
    p_collection_id: collectionId,
  })
  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data : []
}

/**
 * Trek een deellink in (revoke). Audit-vriendelijk: de rij wordt NIET gewist,
 * enkel revoked_at gezet — het spoor blijft. De functie raakt alleen rijen waar
 * revoked_at nog leeg is, dus een eenmaal gezet intrekmoment is onwijzigbaar en
 * er bestaat geen pad om een ingetrokken link te heractiveren.
 * @returns {Promise<boolean>} true als deze aanroep de link introk, false als
 *          hij al ingetrokken was (of niet bestaat).
 */
export async function revokeShare(id) {
  const { data, error } = await supabase.rpc('revoke_collection_share', {
    p_id: id,
  })
  if (error) throw new Error(error.message)
  return data === true
}

/**
 * Haal het gedeelde overzicht op via het token. Draait via de RPC, niet via de
 * tabellen — de ontvanger heeft dus geen brede tabeltoegang nodig.
 * @returns het overzichtsobject { collection, lots, lot_types, days }, of
 *          null bij een onbekend/ingetrokken/verlopen token.
 */
export async function fetchSharedSummary(token) {
  const { data, error } = await supabase.rpc('get_shared_collection_summary', {
    p_token: token,
  })
  if (error) throw new Error(error.message)
  return data ?? null
}
