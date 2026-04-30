import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 800

/**
 * Inline URL-veld met auto-save + status-indicator + "open in nieuw tabblad"
 * link wanneer ingevuld. Geen strikte URL-validatie (Frederik mag plakken
 * wat hij wil); enkel een visuele waarschuwing als het er niet uit ziet
 * als een URL.
 *
 * Props:
 *   table             "lots" of andere
 *   id                row-id
 *   fieldName         kolomnaam (bv. "url_hippomundo")
 *   initialValue      string of null
 *   label             tekst boven het veld
 *   placeholder       tekst in het lege input
 *   onSaved(value)    callback na succesvolle save
 */
export default function AutoSaveUrl({
  table, id, fieldName,
  initialValue, label, placeholder,
  onSaved,
}) {
  const initStr = initialValue ?? ''
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
      setStatus({ state: 'saving' })
      const trimmed = raw.trim()
      const valueToSave = trimmed === '' ? null : trimmed

      const { error } = await supabase
        .from(table)
        .update({ [fieldName]: valueToSave })
        .eq('id', id)

      if (error) {
        setStatus({ state: 'error', msg: error.message })
        return
      }

      baselineRef.current = raw
      setStatus({ state: 'saved', at: new Date() })
      if (onSaved) onSaved(valueToSave)
    }, DEBOUNCE_MS)
  }

  const looksLikeUrl = value.trim().startsWith('http')

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 3, fontSize: '0.9em' }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <input
          type="url"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          style={{
            padding: '0.4rem 0.5rem', flex: 1, minWidth: 240,
            fontFamily: 'inherit', fontSize: '0.9em',
            border: '1px solid #ccc', borderRadius: 4,
            boxSizing: 'border-box',
          }}
        />
        {value.trim() !== '' && looksLikeUrl && (
          <a
            href={value.trim()}
            target="_blank" rel="noopener noreferrer"
            title="Open in nieuw tabblad"
            style={{ fontSize: '1em', textDecoration: 'none' }}
          >
            🔗
          </a>
        )}
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
