import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Dropdown om het lot-type van een lot te kiezen. Toont enkel de types die
 * geactiveerd zijn voor de veiling (via auction_lot_types). Save bij wissel.
 *
 * Props:
 *   lotId          UUID van het lot
 *   collectionId      UUID van de veiling (om de juiste types te tonen)
 *   currentTypeId  huidige lot.lot_type_id (mag null zijn)
 *   currentAuto    huidige lot.lot_type_auto — true als het type automatisch
 *                  is afgeleid bij import. Toont een marker; bij user-wissel
 *                  wordt de flag op false gezet.
 *   onSaved(id)    callback na succesvolle save
 */
export default function LotTypeDropdown({ lotId, collectionId, currentTypeId, currentAuto, onSaved }) {
  const [options, setOptions] = useState([])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)

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
      setOptions(types)
    }
    load()
    return () => { cancelled = true }
  }, [collectionId])

  async function handleChange(e) {
    const newId = e.target.value
    if (!newId) return // Onmogelijk via UI sinds NOT NULL constraint, defensief
    setSaving(true)
    setError(null)
    setSavedAt(null)
    const { error } = await supabase
      .from('lots')
      .update({ lot_type_id: newId, lot_type_auto: false })
      .eq('id', lotId)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setSavedAt(new Date())
    if (onSaved) onSaved(newId)
  }

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
        Lot-type
      </label>
      <select
        value={currentTypeId ?? ''}
        onChange={handleChange}
        disabled={saving}
        style={{
          padding: '0.4rem 0.5rem',
          fontFamily: 'inherit', fontSize: '1em',
          background: 'var(--bg-input)', color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          minWidth: '14em',
        }}
      >
        {options.map((t) => (
          <option key={t.id} value={t.id}>{t.name_nl}</option>
        ))}
      </select>
      {saving && <small style={{ marginLeft: 8, color: 'var(--text-muted)' }}>opslaan…</small>}
      {!saving && savedAt && (
        <small style={{ marginLeft: 8, color: 'var(--success)' }}>
          💾 {savedAt.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
        </small>
      )}
      {error && <small style={{ marginLeft: 8, color: 'var(--danger)' }}>❌ {error}</small>}
      {options.length === 0 && !error && (
        <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 4 }}>
          Geen types beschikbaar — selecteer eerst lot-types op de collectie-pagina.
        </small>
      )}
    </div>
  )
}
