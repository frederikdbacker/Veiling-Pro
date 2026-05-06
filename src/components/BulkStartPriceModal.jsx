import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './Modal'

/**
 * Bulk-startbedrag (Fase 3 item #2 uit POST_ALOGA_ROADMAP.md).
 *
 * Eén invulveld per actief lot-type van de collectie. Bij Toepassen
 * wordt voor elk type alle lots WHERE start_price IS NULL bijgewerkt.
 * Bestaande prijzen blijven onaangeroerd.
 *
 * Props:
 *   collectionId
 *   onClose       () => void
 *   onApplied()   callback na succes — parent kan lots opnieuw fetchen
 */
export default function BulkStartPriceModal({ collectionId, onClose, onApplied }) {
  const [lotTypes, setLotTypes] = useState([])
  const [prices, setPrices] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('collection_lot_types')
        .select('lot_types(id, name_nl, display_order)')
        .eq('collection_id', collectionId)
      if (cancelled) return
      if (error) { setError(error.message); return }
      const types = (data ?? [])
        .map((r) => r.lot_types)
        .filter(Boolean)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      setLotTypes(types)
    }
    load()
    return () => { cancelled = true }
  }, [collectionId])

  async function handleApply() {
    setError(null)
    setBusy(true)
    const filledEntries = lotTypes
      .map((t) => ({ id: t.id, name: t.name_nl, value: prices[t.id] }))
      .filter((e) => e.value !== undefined && e.value !== null && e.value !== '')

    if (filledEntries.length === 0) {
      setError('Vul minstens één bedrag in.')
      setBusy(false)
      return
    }

    const results = []
    for (const entry of filledEntries) {
      const price = Number(entry.value)
      if (Number.isNaN(price) || price < 0) {
        setError(`Ongeldig bedrag voor ${entry.name}: "${entry.value}"`)
        setBusy(false)
        return
      }
      const { count, error: updErr } = await supabase
        .from('lots')
        .update({ start_price: price }, { count: 'exact' })
        .eq('collection_id', collectionId)
        .eq('lot_type_id', entry.id)
        .is('start_price', null)
        .select('id', { count: 'exact', head: true })
      if (updErr) {
        setError(`Fout bij ${entry.name}: ${updErr.message}`)
        setBusy(false)
        return
      }
      results.push({ name: entry.name, count: count ?? 0, price })
    }

    setCounts(results)
    setBusy(false)
    if (onApplied) onApplied()
  }

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <h3 style={{ margin: 0, marginBottom: 'var(--space-3)' }}>Bulk startbedrag</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', margin: '0 0 var(--space-3) 0' }}>
        Eén bedrag per lot-type. Alleen lots <strong>zonder</strong> startbedrag worden bijgewerkt;
        bestaande prijzen blijven onaangeroerd.
      </p>

      {lotTypes.length === 0 && !error && (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Geen actieve lot-types in deze collectie.</p>
      )}

      {lotTypes.map((t) => (
        <div key={t.id} style={rowStyle}>
          <label style={labelStyle}>{t.name_nl}</label>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--text-muted)' }}>€</span>
            <input
              type="number"
              min="0"
              step="100"
              value={prices[t.id] ?? ''}
              onChange={(e) => setPrices((p) => ({ ...p, [t.id]: e.target.value }))}
              placeholder="leeg laten = type overslaan"
              style={inputStyle}
            />
          </div>
        </div>
      ))}

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.9em' }}>❌ {error}</p>}

      {counts && (
        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
          <strong>Toegepast:</strong>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {counts.map((r) => (
              <li key={r.name}>
                {r.name}: {r.count} lot{r.count !== 1 ? 's' : ''} naar €{r.price.toLocaleString('nl-BE')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={cancelBtnStyle} disabled={busy}>
          {counts ? 'Sluiten' : 'Annuleer'}
        </button>
        {!counts && (
          <button type="button" onClick={handleApply} style={confirmBtnStyle} disabled={busy || lotTypes.length === 0}>
            {busy ? 'Toepassen…' : 'Toepassen'}
          </button>
        )}
      </div>
    </Modal>
  )
}

const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '6px 0', borderBottom: '1px solid var(--border-default)',
}
const labelStyle = {
  flex: 1, fontWeight: 600,
}
const inputStyle = {
  width: 120, padding: '6px 8px',
  background: 'var(--bg-input, #1a1a1a)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.95em',
}
const cancelBtnStyle = {
  padding: '6px 14px',
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit',
}
const confirmBtnStyle = {
  padding: '6px 14px',
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: '#fff',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
}
