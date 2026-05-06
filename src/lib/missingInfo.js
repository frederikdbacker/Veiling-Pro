const LABELS = {
  lot_number: 'lot-nummer',
  reserve_price: 'reserveprijs',
  bid_steps: 'biedstap',
  catalog_text: 'catalogustekst',
  equiratings_text: 'EquiRatings',
  photos: 'foto',
  starting_bid: 'startprijs',
  studbook: 'stamboek',
  size: 'maat',
  sire: 'vader',
  dam: 'moeder',
}

// Velden die wél in missing_info kunnen staan maar niet in de banner
// getoond worden (geen waarschuwing voor de gebruiker).
const HIDDEN_FROM_BANNER = new Set(['video_url'])

export function translateMissing(items) {
  if (!Array.isArray(items)) return []
  return items.filter((k) => !HIDDEN_FROM_BANNER.has(k)).map((k) => LABELS[k] ?? k)
}

export function hasMissing(items) {
  if (!Array.isArray(items)) return false
  return items.some((k) => !HIDDEN_FROM_BANNER.has(k))
}
