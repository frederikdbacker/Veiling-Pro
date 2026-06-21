import { supabase } from './supabase'

/**
 * Audit-spoor voor correcties op een al-verkocht lot.
 *
 * Schrijft de gecorrigeerde verkoopvelden weg naar `lots` (de actuele waarde
 * blijft dus bovenaan en alle bestaande queries blijven werken) én logt per
 * daadwerkelijk gewijzigd veld één append-only rij in `lot_sale_corrections`.
 * Zo wordt niets stil overschreven — het origineel blijft in de eerste
 * correctie-rij bewaard.
 *
 *   lotId   het lot
 *   update  object met de lots-kolommen die geschreven worden
 *   diffs   [{ field, oldValue, newValue, oldLabel, newLabel }] — enkel de
 *           gewijzigde velden (leeg = geen correctie-rij, wel lots-update)
 */
export async function applySaleCorrection(lotId, update, diffs) {
  const { data, error } = await supabase
    .from('lots')
    .update(update)
    .eq('id', lotId)
    .select()
    .single()
  if (error) throw error

  if (diffs && diffs.length > 0) {
    const rows = diffs.map((d) => ({
      lot_id: lotId,
      field: d.field,
      old_value: d.oldValue == null ? null : String(d.oldValue),
      new_value: d.newValue == null ? null : String(d.newValue),
      old_label: d.oldLabel ?? null,
      new_label: d.newLabel ?? null,
    }))
    const { error: logError } = await supabase
      .from('lot_sale_corrections')
      .insert(rows)
    if (logError) throw logError
  }
  return data
}

/** Haal de correctiehistoriek van een lot op (nieuwste eerst). */
export async function getSaleCorrections(lotId) {
  const { data, error } = await supabase
    .from('lot_sale_corrections')
    .select('*')
    .eq('lot_id', lotId)
    .order('corrected_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Leesbaar label per correctie-veld. */
export const FIELD_LABELS = {
  sold: 'Verkoopstatus',
  sale_channel: 'Verkoopkanaal',
  sale_price: 'Verkoopprijs',
  buyer: 'Koper',
  spotter_id: 'Spotter',
}
