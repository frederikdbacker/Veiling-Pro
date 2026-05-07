import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Toont een opvouwbare lijst van alle lot_types als checkboxen. Aangevinkt
 * = aanwezig in auction_lot_types voor deze veiling.
 *
 * Bij toggle: insert of delete in auction_lot_types. Lokale state wordt
 * pas geüpdatet na bevestiging van Supabase. Errors worden in een kleine
 * statuslijn getoond.
 *
 * Props:
 *   collectionId        UUID van de veiling
 *   onChange         optionele callback (selectedIds) zodat de parent
 *                    afgeleide UI kan updaten (bv. staffel-editor)
 */
export default function LotTypesSelector({ collectionId, onChange, compact = false }) {
  const [allTypes, setAllTypes] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [error, setError] = useState(null)
  const [busyIds, setBusyIds] = useState(new Set())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const [typesRes, junctionRes] = await Promise.all([
        supabase.from('lot_types').select('*').order('display_order'),
        supabase.from('collection_lot_types').select('lot_type_id').eq('collection_id', collectionId),
      ])
      if (typesRes.error) { setError(typesRes.error.message); return }
      if (junctionRes.error) { setError(junctionRes.error.message); return }

      setAllTypes(typesRes.data ?? [])
      const ids = new Set((junctionRes.data ?? []).map((r) => r.lot_type_id))
      setSelectedIds(ids)
      if (onChange) onChange(ids)
    }
    load()
  }, [collectionId])

  async function toggle(typeId, checked) {
    setBusyIds((prev) => new Set(prev).add(typeId))
    setError(null)

    let err
    if (checked) {
      const { error } = await supabase
        .from('collection_lot_types')
        .insert({ collection_id: collectionId, lot_type_id: typeId })
      err = error
    } else {
      const { error } = await supabase
        .from('collection_lot_types')
        .delete()
        .match({ collection_id: collectionId, lot_type_id: typeId })
      err = error
    }

    setBusyIds((prev) => {
      const next = new Set(prev); next.delete(typeId); return next
    })

    if (err) {
      setError(err.message)
      return
    }

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(typeId)
      else next.delete(typeId)
      if (onChange) onChange(next)
      return next
    })
  }

  const checkboxesGrid = (
    <div style={{
      display: 'flex', flexWrap: 'wrap',
      gap: 'var(--space-2) var(--space-4)',
      marginTop: 'var(--space-3)',
    }}>
      {allTypes.map((t) => {
        const checked = selectedIds.has(t.id)
        const busy = busyIds.has(t.id)
        return (
          <label
            key={t.id}
            style={{
              display: 'flex', gap: 6, alignItems: 'center',
              opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={busy}
              onChange={(e) => toggle(t.id, e.target.checked)}
            />
            {t.name_nl}
          </label>
        )
      })}
    </div>
  )

  if (compact) {
    return (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={compactBtnStyle}
          title="Lot-types in deze collectie"
        >
          🏷 Lot-types ({selectedIds.size}) {open ? '▴' : '▾'}
        </button>
        {open && (
          <div style={dropdownPanelStyle} role="dialog">
            {checkboxesGrid}
            {error && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85em', marginTop: 8 }}>
                ❌ {error}
              </p>
            )}
          </div>
        )}
      </span>
    )
  }

  return (
    <details
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <summary style={{
        cursor: 'pointer',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        Lot-types in deze collectie — {selectedIds.size} aangevinkt
      </summary>
      {checkboxesGrid}
      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '0.85em', marginTop: 8 }}>
          ❌ {error}
        </p>
      )}
    </details>
  )
}

const compactBtnStyle = {
  padding: '0.45rem 0.85rem',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit', fontSize: '0.9em',
  cursor: 'pointer',
}
const dropdownPanelStyle = {
  position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 10,
  minWidth: 280,
  background: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-4)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
}
