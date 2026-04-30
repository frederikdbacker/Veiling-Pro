/**
 * Helper voor bid-step lookup. Gebruikt door de cockpit om automatisch de
 * juiste biedstap te bepalen op basis van huidige bod-prijs en lot-type.
 *
 * Conventie staffel-ranges (afgesproken op 30-04-2026):
 *   - range_from is INCLUSIEF, range_to is EXCLUSIEF — dus [from, to)
 *   - range_to = NULL betekent "tot oneindig"
 */

/**
 * Geeft de juiste step voor een gegeven prijs uit een staffel.
 *
 * @param {number} currentBid  huidige bod-prijs
 * @param {Array}  rules       array van bid_step_rules-records die al
 *                              gefilterd zijn op (auction_id, lot_type_id)
 * @returns {number|null}      step bedrag, of null als geen regel matcht
 */
export function nextBidStep(currentBid, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return null
  if (typeof currentBid !== 'number' || Number.isNaN(currentBid)) return null

  const matching = rules.find((r) => {
    const from = Number(r.range_from ?? 0)
    const to = r.range_to == null ? Infinity : Number(r.range_to)
    return currentBid >= from && currentBid < to
  })

  return matching ? Number(matching.step) : null
}

/**
 * Sorteer rules op range_from oplopend (handig voor weergave en lookup).
 */
export function sortByRangeFrom(rules) {
  return [...rules].sort(
    (a, b) => Number(a.range_from ?? 0) - Number(b.range_from ?? 0)
  )
}
