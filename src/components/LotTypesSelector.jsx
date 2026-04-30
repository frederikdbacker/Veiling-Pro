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
 *   auctionId        UUID van de veiling
 *   onChange         optionele callback (selectedIds) zodat de parent
 *                    afgeleide UI kan updaten (bv. staffel-editor)
 */
export default function LotTypesSelector({ auctionId, onChange }) {
  const [allTypes, setAllTypes] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [error, setError] = useState(null)
  const [busyIds, setBusyIds] = useState(new Set())

  useEffect(() => {
    async function load() {
      const [typesRes, junctionRes] = await Promise.all([
        supabase.from('lot_types').select('*').order('display_order'),
        supabase.from('auction_lot_types').select('lot_type_id').eq('auction_id', auctionId),
      ])
      if (typesRes.error) { setError(typesRes.error.message); return }
      if (junctionRes.error) { setError(junctionRes.error.message); return }

      setAllTypes(typesRes.data ?? [])
      const ids = new Set((junctionRes.data ?? []).map((r) => r.lot_type_id))
      setSelectedIds(ids)
      if (onChange) onChange(ids)
    }
    load()
  }, [auctionId])

  async function toggle(typeId, checked) {
    setBusyIds((prev) => new Set(prev).add(typeId))
    setError(null)

    let err
    if (checked) {
      const { error } = await supabase
        .from('auction_lot_types')
        .insert({ auction_id: auctionId, lot_type_id: typeId })
      err = error
    } else {
      const { error } = await supabase
        .from('auction_lot_types')
        .delete()
        .match({ auction_id: auctionId, lot_type_id: typeId })
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

  return (
    <details
      open
      style={{
        background: '#fafafa', border: '1px solid #eee',
        borderRadius: 6, padding: '0.5rem 0.85rem', marginBottom: '1rem',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        Lot-types in deze veiling — {selectedIds.size} aangevinkt
      </summary>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', marginTop: 8 }}>
        {allTypes.map((t) => {
          const checked = selectedIds.has(t.id)
          const busy = busyIds.has(t.id)
          return (
            <label
              key={t.id}
              style={{
                display: 'flex', gap: 6, alignItems: 'center',
                opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer',
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
      {error && (
        <p style={{ color: '#c33', fontSize: '0.85em', marginTop: 8 }}>
          ❌ {error}
        </p>
      )}
    </details>
  )
}
