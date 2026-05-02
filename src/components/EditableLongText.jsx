import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 800

/**
 * Lange tekst (catalogustekst, EquiRatings) met read-only weergave +
 * edit-icoon. Klik op ✏ → textarea, auto-save bij wijziging.
 *
 * Toont automatisch in edit-modus zolang de waarde leeg is, zodat de
 * gebruiker meteen kan beginnen met typen als de scrape niets vond.
 *
 * Props:
 *   table         "lots"
 *   id            lot-id
 *   fieldName     bv. "catalog_text" of "equiratings_text"
 *   initialValue  huidige waarde (string of null)
 *   placeholder   placeholder bij lege state
 *   rows          aantal rows van de textarea (default 8)
 */
export default function EditableLongText({
  table = 'lots', id, fieldName,
  initialValue, placeholder = 'tekst', rows = 8,
}) {
  const startEmpty = !initialValue || initialValue.trim() === ''
  const [value, setValue] = useState(initialValue ?? '')
  const [editing, setEditing] = useState(startEmpty)
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
        .from(table)
        .update({ [fieldName]: v.trim() === '' ? null : v })
        .eq('id', id)
      if (error) {
        setStatus({ state: 'error', msg: error.message })
      } else {
        baselineRef.current = v
        setStatus({ state: 'saved', at: new Date() })
      }
    }, DEBOUNCE_MS)
  }

  if (editing) {
    return (
      <div>
        <textarea
          value={value}
          onChange={handleChange}
          rows={rows}
          placeholder={`Vul hier de ${placeholder} in...`}
          style={textareaStyle}
          autoFocus
        />
        <div style={editFooterStyle}>
          <SaveIndicator status={status} />
          {!startEmpty && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={doneBtnStyle}
            >
              Klaar
            </button>
          )}
        </div>
      </div>
    )
  }

  // read-only met edit-knop
  return (
    <div style={{ position: 'relative' }}>
      <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.55, paddingRight: '2.5rem' }}>
        {value}
      </p>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={`Bewerk ${placeholder}`}
        aria-label={`Bewerk ${placeholder}`}
        style={editBtnStyle}
      >
        ✏
      </button>
    </div>
  )
}

function SaveIndicator({ status }) {
  const small = { fontSize: '0.8em' }
  switch (status.state) {
    case 'idle':    return <small style={{ ...small, color: 'var(--text-muted)' }}>·</small>
    case 'pending': return <small style={{ ...small, color: 'var(--text-muted)' }}>typen…</small>
    case 'saving':  return <small style={{ ...small, color: 'var(--text-muted)' }}>opslaan…</small>
    case 'saved':   return (
      <small style={{ ...small, color: 'var(--success)' }}>
        💾 opgeslagen om {status.at.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
      </small>
    )
    case 'error':   return (
      <small style={{ ...small, color: 'var(--danger)' }}>
        ❌ {status.msg}
      </small>
    )
    default: return null
  }
}

const textareaStyle = {
  width: '100%',
  padding: '0.6rem 0.85rem',
  fontFamily: 'inherit', fontSize: '0.95em',
  lineHeight: 1.55,
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  resize: 'vertical',
  boxSizing: 'border-box',
}
const editFooterStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginTop: 'var(--space-2)',
}
const doneBtnStyle = {
  padding: '0.3rem 0.75rem',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
}
const editBtnStyle = {
  position: 'absolute', top: 0, right: 0,
  width: 32, height: 32,
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontSize: '0.95em',
}
