import { supabase } from './supabase'

// ============================================================
// shares — beheer van niet-raadbare deellinks voor het eindoverzicht.
//
// Een deellink verwijst NIET naar de interne route /collections/<uuid>/summary
// (die verraadt de app-structuur en hangt achter de login), maar naar de
// publieke, kale route /gedeeld/<token>. Het token is lang en willekeurig
// (192-bit) en staat los van elke interne id.
//
// De ONTVANGER leest de data uitsluitend via de SECURITY DEFINER-functie
// get_shared_collection_summary(token) (migratie 0039): die geeft enkel die
// ene collectie terug. Zie fetchSharedSummary().
// ============================================================

const TABLE = 'collection_shares'

/**
 * Genereer een URL-veilig, willekeurig token (192-bit → 48 hex-tekens).
 * crypto.getRandomValues is cryptografisch sterk; de kans op raden of botsing
 * is verwaarloosbaar (de unique-constraint op de kolom vangt een botsing af).
 */
function generateToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** De volledige, deelbare URL voor een token. */
export function shareUrl(token) {
  return `${window.location.origin}/gedeeld/${token}`
}

/**
 * Geef een bestaande actieve deellink voor de collectie terug, of maak er een.
 * "Actief" = niet ingetrokken en niet verlopen. Zo krijgt Frederik bij herhaald
 * klikken op "Link kopiëren" telkens dezelfde link i.p.v. een wildgroei aan
 * tokens.
 * @returns {Promise<{ token: string, url: string, reused: boolean }>}
 */
export async function getOrCreateShare(collectionId) {
  const nowIso = new Date().toISOString()

  const { data: existing, error: selErr } = await supabase
    .from(TABLE)
    .select('token, expires_at')
    .eq('collection_id', collectionId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (selErr) throw new Error(selErr.message)

  const active = (existing ?? []).find(
    (r) => r.expires_at == null || r.expires_at > nowIso
  )
  if (active) {
    return { token: active.token, url: shareUrl(active.token), reused: true }
  }

  const token = generateToken()
  const { error: insErr } = await supabase
    .from(TABLE)
    .insert({ collection_id: collectionId, token, created_by: 'frederik' })
  if (insErr) throw new Error(insErr.message)

  return { token, url: shareUrl(token), reused: false }
}

/** Alle deellinks voor een collectie (nieuwste eerst), voor het beheer-overzicht. */
export async function listShares(collectionId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, token, label, created_at, revoked_at, expires_at')
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Trek een deellink in (revoke). Audit-vriendelijk: de rij wordt NIET gewist,
 * enkel revoked_at gezet — het spoor blijft. Na intrekken geeft de RPC voor dat
 * token niets meer terug.
 */
export async function revokeShare(id) {
  const { error } = await supabase
    .from(TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
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
