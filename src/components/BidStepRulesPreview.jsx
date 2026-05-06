import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sortByRangeFrom } from '../lib/bidSteps'

/**
 * Read-only weergave van de biedstap-staffel voor een gegeven lot-type
 * binnen een veiling. Updaten gebeurt op de AuctionPage; hier puur
 * informatief.
 */
export default function BidStepRulesPreview({ collectionId, lotTypeId }) {
  const [rules, setRules] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    setError(null)
    if (!collectionId || !lotTypeId) {
      setRules([])
      return
    }
    let cancelled = false
    supabase
      .from('bid_step_rules')
      .select('*')
      .eq('collection_id', collectionId)
      .eq('lot_type_id', lotTypeId)
      .then((res) => {
        if (cancelled) return
        if (res.error) setError(res.error.message)
        else setRules(res.data ?? [])
      })
    return () => { cancelled = true }
  }, [collectionId, lotTypeId])

  if (!lotTypeId) {
    return <p style={emptyStyle}>Kies eerst een lot-type om de biedstappen te zien.</p>
  }
  if (error) {
    return <p style={{ color: 'var(--danger)', fontSize: '0.9em' }}>❌ {error}</p>
  }
  if (rules.length === 0) {
    return (
      <p style={emptyStyle}>
        Nog geen biedstappen ingesteld voor dit type. Stel ze in op de veiling-pagina.
      </p>
    )
  }

  const sorted = sortByRangeFrom(rules)

  return (
    <ul style={listStyle} className="num">
      {sorted.map((rule) => (
        <li key={rule.id} style={ruleRowStyle}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {formatEuro(rule.range_from)} – {rule.range_to == null ? '∞' : formatEuro(rule.range_to)}
          </span>
          <strong style={{ color: 'var(--accent)' }}>{formatEuro(rule.step)}</strong>
        </li>
      ))}
    </ul>
  )
}

const emptyStyle = {
  color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9em',
  margin: 0,
}
const listStyle = {
  listStyle: 'none', padding: 0, margin: 0,
  fontSize: '0.95em',
}
const ruleRowStyle = {
  display: 'flex', justifyContent: 'space-between',
  padding: '3px 0',
  borderBottom: '1px solid var(--border-default)',
}

function formatEuro(value) {
  if (value == null) return '∞'
  const n = Number(value)
  return `€${n.toLocaleString('nl-BE', { maximumFractionDigits: 0 })}`
}
