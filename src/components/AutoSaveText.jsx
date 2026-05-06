import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 800

/**
 * Inline tekst-input met auto-save + status-indicator. Generiek over
 * elke tabel + kolom.
 *
 * Props:
 *   table             tabel-naam (bv. 'auction_houses', 'collections')
 *   id                row-id om te updaten
 *   fieldName         kolomnaam (bv. 'name', 'country', 'location')
 *   initialValue      string of null
 *   label             optionele tekst boven het veld
 *   placeholder       tekst op input wanneer leeg
 *   inputType         'text' (default), 'date', 'datetime-local', 'time'
 *   onSaved(value)    callback na succesvolle save — parent updatet state
 *   compact           true → strakkere spacing
 */
export default function AutoSaveText({
  table, id, fieldName,
  initialValue, label, placeholder,
  inputType = 'text',
  compact = false,
  onSaved,
}) {
  const initStr = initialValue ?? ''
  const [value, setValue] = useState(initStr)
  const [status, setStatus] = useState({ state: 'idle' })
  const baselineRef = useRef(initStr)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  useEffect(() => {
    setValue(initialValue ?? '')
    baselineRef.current = initialValue ?? ''
  }, [id, initialValue])

  function handleChange(e) {
    const v = e.target.value
    setValue(v)

    if (timerRef.current) clearTimeout(timerRef.current)
    if (v === baselineRef.current) {
      setStatus({ state: 'idle' })
      return
    }
    setStatus({ state: 'pending' })

    timerRef.current = setTimeout(async () => {
      setStatus({ state: 'saving' })
      const payload = v === '' ? null : v
      const { error } = await supabase
        .from(table)
        .update({ [fieldName]: payload })
        .eq('id', id)
      if (error) {
        setStatus({ state: 'error', msg: error.message })
      } else {
        baselineRef.current = v
        setStatus({ state: 'saved', at: new Date() })
        if (onSaved) onSaved(payload)
      }
    }, DEBOUNCE_MS)
  }

  return (
    <div style={{ marginTop: compact ? '0.4rem' : '0.75rem' }}>
      {label && (
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.9em' }}>
          {label}
        </label>
      )}
      <input
        type={inputType}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={inputStyle}
      />
      <SaveIndicator status={status} />
    </div>
  )
}

function SaveIndicator({ status }) {
  const small = { fontSize: '0.8em', marginLeft: 6 }
  switch (status.state) {
    case 'idle':    return null
    case 'pending': return <small style={{ ...small, color: 'var(--text-muted)' }}>typen…</small>
    case 'saving':  return <small style={{ ...small, color: 'var(--text-muted)' }}>opslaan…</small>
    case 'saved':   return (
      <small style={{ ...small, color: 'var(--success)' }}>
        💾 {status.at.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
      </small>
    )
    case 'error':   return <small style={{ ...small, color: 'var(--danger)' }}>❌ {status.msg}</small>
    default: return null
  }
}

const inputStyle = {
  width: '100%',
  maxWidth: 480,
  padding: '6px 10px',
  fontFamily: 'inherit',
  fontSize: '0.95em',
  background: 'var(--bg-input, #1a1a1a)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  boxSizing: 'border-box',
}
