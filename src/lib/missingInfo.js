const LABELS = {
  lot_number: 'lot-nummer',
  video_url: 'video',
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

export function translateMissing(items) {
  if (!Array.isArray(items)) return []
  return items.map((k) => LABELS[k] ?? k)
}

export function hasMissing(items) {
  return Array.isArray(items) && items.length > 0
}
