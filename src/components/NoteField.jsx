import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 800

export default function NoteField({ lotId, fieldName, initialValue, label, compact = false }) {
  const [value, setValue] = useState(initialValue ?? '')
  const [status, setStatus] = useState({ state: 'idle' })
  const baselineRef = useRef(initialValue ?? '')
  const timerRef = useRef(null)
  const textareaRef = useRef(null)

  // Cancel pending save on unmount (bv. bij navigatie naar ander lot)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Auto-resize textarea in compact-modus zodat hoogte matcht met inhoud
  useEffect(() => {
    if (!compact) return
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }, [value, compact])

  function handleChange(e) {
    const newValue = e.target.value
    setValue(newValue)

    if (timerRef.current) clearTimeout(timerRef.current)

    if (newValue === baselineRef.current) {
      setStatus({ state: 'idle' })
      return
    }

    setStatus({ state: 'pending' })

    timerRef.current = setTimeout(async () => {
      setStatus({ state: 'saving' })
      const { error } = await supabase
        .from('lots')
        .update({ [fieldName]: newValue })
        .eq('id', lotId)

      if (error) {
        setStatus({ state: 'error', msg: error.message })
      } else {
        baselineRef.current = newValue
        setStatus({ state: 'saved', at: new Date() })
      }
    }, DEBOUNCE_MS)
  }

  return (
    <div style={{ marginTop: compact ? '0.2rem' : '1rem' }}>
      {label && (
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 2 }}>
          {label}
        </label>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        rows={compact ? 1 : 4}
        style={{
          width: '100%', padding: 8, fontFamily: 'inherit', fontSize: '0.95em',
          border: '1px solid #ccc', borderRadius: 4,
          resize: compact ? 'none' : 'vertical',
          overflow: compact ? 'hidden' : 'auto',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ minHeight: compact ? 0 : '1.2em', marginTop: compact ? 0 : 2 }}>
        <SaveIndicator status={status} />
      </div>
    </div>
  )
}

function SaveIndicator({ status }) {
  const small = { fontSize: '0.8em' }
  switch (status.state) {
    case 'idle':    return null
    case 'pending': return <small style={{ ...small, color: '#aaa' }}>typen…</small>
    case 'saving':  return <small style={{ ...small, color: '#aaa' }}>opslaan…</small>
    case 'saved':   return (
      <small style={{ ...small, color: '#5A8A5A' }}>
        💾 opgeslagen om {status.at.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
      </small>
    )
    case 'error':   return (
      <small style={{ ...small, color: '#c33' }}>
        ❌ niet opgeslagen — {status.msg}
      </small>
    )
    default: return null
  }
}
