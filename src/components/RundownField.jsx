import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_RUNDOWN } from '../lib/rundown'

const DEBOUNCE_MS = 800

/**
 * Auto-save tekstveld voor de veiling-rundown (#5).
 * Wanneer collection.rundown_text leeg is wordt DEFAULT_RUNDOWN als
 * startwaarde getoond zodat Frederik niet vanaf nul hoeft te beginnen.
 *
 * Props:
 *   collectionId
 *   initialValue   huidige rundown_text uit collections-row (mag null zijn)
 *   onSaved(value) callback na succesvolle save
 */
export default function RundownField({ collectionId, initialValue, onSaved }) {
  const startValue = (initialValue == null || initialValue === '') ? DEFAULT_RUNDOWN : initialValue
  const [value, setValue] = useState(startValue)
  const [status, setStatus] = useState({ state: 'idle' })
  const baselineRef = useRef(initialValue ?? '')
  const timerRef = useRef(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

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
      const { error } = await supabase
        .from('collections')
        .update({ rundown_text: v })
        .eq('id', collectionId)
      if (error) {
        setStatus({ state: 'error', msg: error.message })
      } else {
        baselineRef.current = v
        setStatus({ state: 'saved', at: new Date() })
        if (onSaved) onSaved(v)
      }
    }, DEBOUNCE_MS)
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={handleChange}
        rows={10}
        style={textareaStyle}
        placeholder="Rundown — vrij tekstveld, gebruikt als startscherm in de cockpit."
      />
      <SaveIndicator status={status} />
    </div>
  )
}

function SaveIndicator({ status }) {
  const small = { fontSize: '0.8em' }
  switch (status.state) {
    case 'idle':    return null
    case 'pending': return <small style={{ ...small, color: 'var(--text-muted)' }}>typen…</small>
    case 'saving':  return <small style={{ ...small, color: 'var(--text-muted)' }}>opslaan…</small>
    case 'saved':   return (
      <small style={{ ...small, color: 'var(--success)' }}>
        💾 opgeslagen om {status.at.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
      </small>
    )
    case 'error':   return <small style={{ ...small, color: 'var(--danger)' }}>❌ {status.msg}</small>
    default: return null
  }
}

const textareaStyle = {
  width: '100%',
  padding: 10,
  fontFamily: 'inherit',
  fontSize: '0.95em',
  background: 'var(--bg-input, #1a1a1a)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  resize: 'vertical',
  boxSizing: 'border-box',
  lineHeight: 1.5,
}
