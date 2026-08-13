// ============================================================
// summaryStats — pure rekenlaag voor het eindoverzicht.
//
// Zowel de INTERNE overzichtspagina (CollectionSummaryPage) als de KALE
// gedeelde weergave (SharedSummaryPage) draaien op exact dezelfde cijfers.
// Alles hier is puur (geen React, geen Supabase) zodat de twee weergaven
// nooit uit elkaar lopen.
// ============================================================

/**
 * Bereken alle afgeleide cijfers + groeperingen voor een collectie-overzicht.
 * @param {Array} lots      lot-rijen (zie kolommenlijst in de loaders)
 * @param {Array} lotTypes  [{ id, name_nl }]
 * @returns object met alle waarden die de weergave nodig heeft
 */
export function computeSummary(lots, lotTypes) {
  const safeLots = Array.isArray(lots) ? lots : []

  // Charity- én withdrawn-lots tellen niet mee in omzetstatistieken
  // (#6 = charity, migratie 0027 = withdrawn). Withdrawn krijgt een eigen sectie.
  const regularLots   = safeLots.filter((l) => !l.is_charity && !l.withdrawn)
  const charityLots   = safeLots.filter((l) => l.is_charity && !l.withdrawn)
  const withdrawnLots  = safeLots.filter((l) => l.withdrawn)

  const total    = regularLots.length
  const hammered = regularLots.filter((l) => l.time_hammer != null)
  const sold     = regularLots.filter((l) => l.sold === true && l.sale_price != null)
  const notSold  = regularLots.filter((l) => l.sold === false)
  const isFinished = total > 0 && hammered.length === total

  const totalRevenue = sold.reduce((s, l) => s + (Number(l.sale_price) || 0), 0)
  const avgSalePrice = sold.length > 0 ? totalRevenue / sold.length : null

  const durations = hammered
    .map((l) => l.duration_seconds)
    .filter((s) => Number.isFinite(s) && s > 0)
  const avgDurationSec = durations.length > 0
    ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
    : null

  const firstStartMs = hammered.length > 0
    ? Math.min(...hammered.map((l) =>
        new Date(l.time_entered_ring ?? l.time_bidding_start ?? l.time_hammer).getTime()
      ))
    : null
  const lastHammerMs = hammered.length > 0
    ? Math.max(...hammered.map((l) => new Date(l.time_hammer).getTime()))
    : null
  const wallclockSec = firstStartMs != null && lastHammerMs != null
    ? Math.round((lastHammerMs - firstStartMs) / 1000)
    : null

  // Groepeer reguliere lots op lot_type_id (charity uitgesloten — eigen rij)
  const typeIdToName = new Map((lotTypes ?? []).map((t) => [t.id, t.name_nl]))
  const byTypeMap = new Map()
  for (const lot of regularLots) {
    const key = lot.lot_type_id ?? '__none__'
    if (!byTypeMap.has(key)) {
      byTypeMap.set(key, {
        typeName: typeIdToName.get(lot.lot_type_id) ?? 'Geen type',
        lots: [],
      })
    }
    byTypeMap.get(key).lots.push(lot)
  }
  const groups = [...byTypeMap.values()].sort((a, b) => b.lots.length - a.lots.length)

  return {
    regularLots, charityLots, withdrawnLots,
    total, hammered, sold, notSold, isFinished,
    totalRevenue, avgSalePrice, avgDurationSec, wallclockSec,
    groups,
  }
}

export function formatNum(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 0 })
}

export function formatMmSs(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatHoursMinutes(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}u ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

export function formatAuctionDate(collection) {
  if (!collection?.date) return '(datum onbekend)'
  const d = new Date(collection.date)
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDayDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })
}
