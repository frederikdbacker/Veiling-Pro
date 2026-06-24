// Gedeelde helpers voor veilingdagen (collection_days, migratie 0031) in
// de import-/scrape-scripts. Houden de import-scripts dag-bewust zonder de
// logica te dupliceren.

/**
 * Zorg dat een collectie de gevraagde veilingdagen heeft (idempotent).
 *
 * @param sb            Supabase-client
 * @param collectionId  collectie-id
 * @param dates         array ISO-datumstrings (mag null-elementen bevatten);
 *                      lengte = aantal gewenste dagen. Leeg/[] → 1 dag zonder datum.
 * @returns dag-rijen { id, day_index, date } gesorteerd op day_index
 *
 * Bestaande dagen worden niet gedupliceerd: voor elke index 1..n wordt één
 * dag gegarandeerd; ontbrekende datums worden bijgewerkt (nooit overschreven
 * met null).
 */
export async function ensureDays(sb, collectionId, dates = []) {
  const wanted = dates.length > 0 ? dates : [null]
  const { data: existing } = await sb
    .from('collection_days')
    .select('id, day_index, date')
    .eq('collection_id', collectionId)
    .order('day_index')
  const byIndex = new Map((existing ?? []).map((d) => [d.day_index, d]))

  for (let i = 0; i < wanted.length; i++) {
    const idx = i + 1
    const date = wanted[i] ?? null
    if (byIndex.has(idx)) {
      const cur = byIndex.get(idx)
      if (date && cur.date !== date) {
        await sb.from('collection_days').update({ date }).eq('id', cur.id)
      }
    } else {
      const { data, error } = await sb
        .from('collection_days')
        .insert({ collection_id: collectionId, day_index: idx, date })
        .select('id, day_index, date')
        .single()
      if (error) throw new Error(`veilingdag ${idx} aanmaken: ${error.message}`)
      byIndex.set(idx, data)
    }
  }

  const { data: all } = await sb
    .from('collection_days')
    .select('id, day_index, date')
    .eq('collection_id', collectionId)
    .order('day_index')
  return all ?? []
}

/**
 * Bepaal de collection_day_id voor één paard op basis van (in volgorde):
 *   1. h.day_index (1-based) → die dag
 *   2. h.day_date (ISO) → de dag met die datum
 *   3. fallbackDayId (meestal dag 1) zodat het lot zichtbaar blijft in de cockpit
 *
 * @param h           paard-object uit de import-JSON
 * @param days        dag-rijen (uit ensureDays)
 * @param fallbackDayId  dag-id bij ontbrekende dag-info (mag null = unassigned)
 */
export function resolveDayId(h, days, fallbackDayId) {
  if (h.day_index != null) {
    const d = days.find((x) => x.day_index === Number(h.day_index))
    if (d) return d.id
  }
  if (h.day_date) {
    const d = days.find((x) => x.date === h.day_date)
    if (d) return d.id
  }
  return fallbackDayId ?? null
}
