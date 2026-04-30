import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 800

export default function NoteField({ lotId, fieldName, initialValue, label }) {
  const [value, setValue] = useState(initialValue ?? '')
  const [status, setStatus] = useState({ state: 'idle' })
  const baselineRef = useRef(initialValue ?? '')
  const timerRef = useRef(null)

  // Cancel pending save on unmount (bv. bij navigatie naar ander lot)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

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
    <div style={{ marginTop: '1rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={handleChange}
        rows={4}
        style={{
          width: '100%', padding: 8, fontFamily: 'inherit', fontSize: '0.95em',
          border: '1px solid #ccc', borderRadius: 4, resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ minHeight: '1.2em', marginTop: 2 }}>
        <SaveIndicator status={status} />
      </div>
    </div>
  )
}

function SaveIndicator({ status }) {
  const small = { fontSize: '0.8em' }
  switch (status.state) {
    case 'idle':    return <small style={{ ...small, color: '#bbb' }}>·</small>
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
