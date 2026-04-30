import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sortByRangeFrom } from '../lib/bidSteps'

/**
 * Read-only weergave van de biedstap-staffel voor een gegeven lot-type
 * binnen een veiling. Updaten gebeurt op de AuctionPage; hier puur
 * informatief.
 */
export default function BidStepRulesPreview({ auctionId, lotTypeId }) {
  const [rules, setRules] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    setError(null)
    if (!auctionId || !lotTypeId) {
      setRules([])
      return
    }
    let cancelled = false
    supabase
      .from('bid_step_rules')
      .select('*')
      .eq('auction_id', auctionId)
      .eq('lot_type_id', lotTypeId)
      .then((res) => {
        if (cancelled) return
        if (res.error) setError(res.error.message)
        else setRules(res.data ?? [])
      })
    return () => { cancelled = true }
  }, [auctionId, lotTypeId])

  if (!lotTypeId) {
    return (
      <p style={emptyStyle}>
        Kies eerst een lot-type om de biedstappen te zien.
      </p>
    )
  }

  if (error) {
    return <p style={{ color: '#c33', fontSize: '0.85em' }}>❌ {error}</p>
  }

  if (rules.length === 0) {
    return (
      <p style={emptyStyle}>
        Nog geen biedstappen ingesteld voor dit type. Stel ze in op de
        veiling-pagina.
      </p>
    )
  }

  const sorted = sortByRangeFrom(rules)

  return (
    <div style={blockStyle}>
      <div style={{ fontWeight: 600, fontSize: '0.9em', color: '#555', marginBottom: 4 }}>
        Biedstappen voor dit type
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.9em' }}>
        {sorted.map((rule) => (
          <li key={rule.id} style={{ color: '#555', padding: '2px 0' }}>
            {formatEuro(rule.range_from)} – {rule.range_to == null ? '∞' : formatEuro(rule.range_to)}
            : <strong>{formatEuro(rule.step)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

const emptyStyle = {
  color: '#999', fontStyle: 'italic', fontSize: '0.85em',
  margin: '0 0 0.75rem 0',
}

const blockStyle = {
  background: '#fafafa', border: '1px solid #eee',
  borderRadius: 4, padding: '0.5rem 0.75rem',
  marginBottom: '0.75rem',
}

function formatEuro(value) {
  if (value == null) return '∞'
  const n = Number(value)
  return `€${n.toLocaleString('nl-BE', { maximumFractionDigits: 0 })}`
}
