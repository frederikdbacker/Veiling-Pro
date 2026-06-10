import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sortByRangeFrom } from '../lib/bidSteps'

/**
 * BidTracker — efemeer geheugensteuntje tijdens een veiling. Toont een
 * huidig bedrag dat met +/– volgens de bestaande biedstappen kan worden
 * verhoogd of verlaagd, en kan ook handmatig getypt worden.
 *
 * Bewust pure UI-state: niets wordt naar de DB geschreven. Bij wissel van
 * lot (lotId-prop) resetten we naar de startprijs van dat lot.
 */
export default function BidTracker({ lotId, collectionId, lotTypeId, startPrice, spotters = [] }) {
  const [rules, setRules] = useState([])
  const [amount, setAmount] = useState(Number(startPrice) || 0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [spotterId, setSpotterId] = useState('')
  const [log, setLog] = useState([])

  // Reset bij nieuw lot
  useEffect(() => {
    setAmount(Number(startPrice) || 0)
    setEditing(false)
    setSpotterId('')
    setLog([])
  }, [lotId, startPrice])

  function logBid(newAmount) {
    setLog((prev) => [
      ...prev,
      { amount: newAmount, spotterId: spotterId || null, ts: Date.now() },
    ])
  }

  // Biedstappen ophalen
  useEffect(() => {
    if (!collectionId || !lotTypeId) { setRules([]); return }
    let cancelled = false
    supabase
      .from('bid_step_rules')
      .select('*')
      .eq('collection_id', collectionId)
      .eq('lot_type_id', lotTypeId)
      .then((res) => {
        if (cancelled) return
        if (res.error) return
        setRules(sortByRangeFrom(res.data ?? []))
      })
    return () => { cancelled = true }
  }, [collectionId, lotTypeId])

  function stepFor(n) {
    const rule = rules.find((r) => {
      const from = Number(r.range_from)
      const to   = r.range_to == null ? Infinity : Number(r.range_to)
      return n >= from && n < to
    })
    return rule ? Number(rule.step) : 0
  }

  function up() {
    setAmount((prev) => {
      const s = stepFor(prev)
      if (s <= 0) return prev
      const next = prev + s
      logBid(next)
      return next
    })
  }

  function down() {
    setAmount((prev) => {
      const probe = Math.max(0, prev - 1)
      const s = stepFor(probe)
      const next = s > 0 ? Math.max(0, prev - s) : prev
      if (next !== prev) logBid(next)
      return next
    })
  }

  function reset() {
    setAmount(Number(startPrice) || 0)
    setLog([])
  }

  function startEdit() {
    setDraft(String(amount))
    setEditing(true)
  }

  function commitEdit() {
    const n = Number(draft.replace(/[^\d.,-]/g, '').replace(',', '.'))
    if (Number.isFinite(n) && n >= 0) {
      const rounded = Math.round(n)
      setAmount(rounded)
      logBid(rounded)
    }
    setEditing(false)
  }

  const step = stepFor(amount)
  const hasRules = rules.length > 0

  return (
    <div>
      <div style={subtitleStyle}>
        Bod-tracker
        <span style={hintStyle}>geheugensteuntje, niet opgeslagen</span>
      </div>

      <div style={trackerRowStyle}>
        <button
          type="button"
          onClick={down}
          disabled={!hasRules || amount <= 0}
          style={stepBtnStyle}
          title={step > 0 ? `−€${formatNum(step)}` : 'geen biedstap'}
        >
          −
        </button>

        {editing ? (
          <input
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') setEditing(false)
            }}
            autoFocus
            style={amountInputStyle}
            className="num"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            style={amountBtnStyle}
            className="num"
            title="Klik om bedrag te typen"
          >
            €{formatNum(amount)}
          </button>
        )}

        <button
          type="button"
          onClick={up}
          disabled={!hasRules}
          style={{ ...stepBtnStyle, ...stepBtnUpStyle }}
          title={step > 0 ? `+€${formatNum(step)}` : 'geen biedstap'}
        >
          +
        </button>

        <button
          type="button"
          onClick={reset}
          style={resetBtnStyle}
          title="Terug naar startprijs"
        >
          ↺
        </button>
      </div>

      {hasRules ? (
        <div style={stepHintStyle}>
          stap: <strong>€{formatNum(step || 0)}</strong>
        </div>
      ) : (
        <div style={stepHintStyle}>
          ⚠ geen biedstappen ingesteld voor dit lot-type
        </div>
      )}

      {spotters.length > 0 && (
        <div style={spotterRowStyle}>
          <label style={spotterLabelStyle}>Spotter:</label>
          <select
            value={spotterId}
            onChange={(e) => setSpotterId(e.target.value)}
            style={spotterSelectStyle}
          >
            <option value="">— niemand —</option>
            {spotters.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {log.length > 0 && (
        <ul style={logStyle} className="num">
          {[...log].reverse().slice(0, 6).map((entry, i) => {
            const sp = spotters.find((s) => s.id === entry.spotterId)
            return (
              <li key={entry.ts + '-' + i} style={logRowStyle}>
                <span>€{formatNum(entry.amount)}</span>
                <span style={logSpotterStyle}>
                  {sp ? sp.name : '—'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function formatNum(n) {
  return Number(n).toLocaleString('nl-BE', { maximumFractionDigits: 0 })
}

const subtitleStyle = {
  display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
  fontSize: '0.7rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontWeight: 600,
  marginBottom: 'var(--space-2)',
}

const hintStyle = {
  textTransform: 'none',
  letterSpacing: 'normal',
  fontSize: '0.7rem',
  fontWeight: 400,
  color: 'var(--text-muted)',
  fontStyle: 'italic',
}

const trackerRowStyle = {
  display: 'flex', alignItems: 'stretch', gap: 6,
}

const stepBtnStyle = {
  flex: '0 0 44px',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '1.4rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  height: 44,
}

const stepBtnUpStyle = {
  background: 'var(--accent)',
  color: 'var(--bg-base)',
  border: '1px solid var(--accent)',
}

const amountBtnStyle = {
  flex: 1,
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '1.2rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: '0 var(--space-3)',
  height: 44,
  textAlign: 'center',
}

const amountInputStyle = {
  ...amountBtnStyle,
  fontFamily: 'inherit',
}

const resetBtnStyle = {
  flex: '0 0 36px',
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '1rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  height: 44,
}

const stepHintStyle = {
  marginTop: 6,
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
}

const spotterRowStyle = {
  display: 'flex', alignItems: 'center', gap: 6,
  marginTop: 'var(--space-2)',
}

const spotterLabelStyle = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  flexShrink: 0,
}

const spotterSelectStyle = {
  flex: 1,
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 6px',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  cursor: 'pointer',
}

const logStyle = {
  listStyle: 'none', padding: 0,
  margin: 'var(--space-2) 0 0 0',
  display: 'flex', flexDirection: 'column', gap: 2,
}

const logRowStyle = {
  display: 'flex', justifyContent: 'space-between',
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  padding: '2px 0',
  borderBottom: '1px solid var(--border-default)',
}

const logSpotterStyle = {
  color: 'var(--text-muted)',
  fontStyle: 'italic',
}
