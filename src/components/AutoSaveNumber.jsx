import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 800

/**
 * Inline numeric field met auto-save + status-indicator.
 *
 * Props:
 *   table              "lots" of "auctions"
 *   id                 row-id om te updaten
 *   fieldName          kolomnaam (bv. "number", "reserve_price", "bid_steps")
 *   initialValue       startwaarde (number of null)
 *   label              tekst boven het veld
 *   step / min         doorgegeven aan <input type="number">
 *   prefix / suffix    optionele tekst voor/achter het veld (bv. "€")
 *   placeholder        idem op het input-element
 *   missingInfoKey     als gezet: na succesvolle save met niet-null waarde
 *                      wordt deze key uit lots.missing_info gefilterd
 *                      (alleen relevant voor table="lots")
 *   onSaved(value, newMissingInfo)
 *                      callback voor parent — om lokale state te syncen
 */
export default function AutoSaveNumber({
  table, id, fieldName,
  initialValue, label,
  step = 1, min, prefix, suffix, placeholder,
  missingInfoKey,
  onSaved,
}) {
  const initStr = initialValue == null ? '' : String(initialValue)
  const [value, setValue] = useState(initStr)
  const [status, setStatus] = useState({ state: 'idle' })
  const baselineRef = useRef(initStr)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleChange(e) {
    const raw = e.target.value
    setValue(raw)

    if (timerRef.current) clearTimeout(timerRef.current)

    if (raw === baselineRef.current) {
      setStatus({ state: 'idle' })
      return
    }

    setStatus({ state: 'pending' })

    timerRef.current = setTimeout(async () => {
      const trimmed = raw.trim()
      let parsed
      if (trimmed === '') {
        parsed = null
      } else {
        parsed = Number(trimmed)
        if (Number.isNaN(parsed)) {
          setStatus({ state: 'error', msg: 'geen geldig getal' })
          return
        }
      }

      setStatus({ state: 'saving' })

      const updates = { [fieldName]: parsed }
      let newMissingInfo = null

      if (missingInfoKey && parsed != null && table === 'lots') {
        const { data: cur } = await supabase
          .from('lots').select('missing_info').eq('id', id).single()
        if (cur) {
          const filtered = (cur.missing_info ?? []).filter((k) => k !== missingInfoKey)
          if (filtered.length !== (cur.missing_info ?? []).length) {
            newMissingInfo = filtered
            updates.missing_info = filtered
          }
        }
      }

      const { error } = await supabase.from(table).update(updates).eq('id', id)

      if (error) {
        setStatus({ state: 'error', msg: error.message })
        return
      }

      baselineRef.current = raw
      setStatus({ state: 'saved', at: new Date() })
      if (onSaved) onSaved(parsed, newMissingInfo)
    }, DEBOUNCE_MS)
  }

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {prefix && <span style={{ color: '#666' }}>{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={handleChange}
          step={step}
          min={min}
          placeholder={placeholder}
          style={{
            padding: '0.4rem 0.5rem',
            fontFamily: 'inherit', fontSize: '1em',
            border: '1px solid #ccc', borderRadius: 4,
            width: '9em',
            boxSizing: 'border-box',
          }}
        />
        {suffix && <span style={{ color: '#666' }}>{suffix}</span>}
        <SaveIndicator status={status} />
      </div>
    </div>
  )
}

function SaveIndicator({ status }) {
  const base = { fontSize: '0.8em', marginLeft: 4 }
  switch (status.state) {
    case 'idle':    return <small style={{ ...base, color: '#bbb' }}>·</small>
    case 'pending': return <small style={{ ...base, color: '#aaa' }}>typen…</small>
    case 'saving':  return <small style={{ ...base, color: '#aaa' }}>opslaan…</small>
    case 'saved':
      return (
        <small style={{ ...base, color: '#5A8A5A' }}>
          💾 {status.at.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
        </small>
      )
    case 'error':   return <small style={{ ...base, color: '#c33' }}>❌ {status.msg}</small>
    default:        return null
  }
}
