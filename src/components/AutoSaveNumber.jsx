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
 *   displayWithThousands
 *                      als true: render als text-input met puntjes als
 *                      duizendscheiding (bv. "1.500" ipv "1500"). De
 *                      onderliggende waarde blijft een number; alleen de
 *                      visuele representatie verandert. `step` en `min`
 *                      worden in deze modus genegeerd.
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
  displayWithThousands = false,
  presets,
  missingInfoKey,
  onSaved,
}) {
  const datalistId = presets && presets.length > 0
    ? `presets-${table}-${id}-${fieldName}`
    : null
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
    const raw = displayWithThousands
      ? e.target.value.replace(/[^\d]/g, '')
      : e.target.value
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

  const inputEl = (
    <>
      {prefix && <span style={{ color: 'var(--text-muted)' }}>{prefix}</span>}
      <input
        type={displayWithThousands ? 'text' : 'number'}
        inputMode={displayWithThousands ? 'numeric' : undefined}
        value={displayWithThousands ? formatThousands(value) : value}
        onChange={handleChange}
        step={displayWithThousands ? undefined : step}
        min={displayWithThousands ? undefined : min}
        placeholder={placeholder}
        aria-label={label}
        list={datalistId ?? undefined}
        style={{
          padding: '0.4rem 0.5rem',
          fontFamily: 'inherit', fontSize: '1em',
          background: 'var(--bg-input)', color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          width: '8em',
          boxSizing: 'border-box',
        }}
      />
      {datalistId && (
        <datalist id={datalistId}>
          {presets.map((p) => (
            <option
              key={p}
              value={displayWithThousands ? formatThousands(p) : p}
            />
          ))}
        </datalist>
      )}
      {suffix && <span style={{ color: 'var(--text-muted)' }}>{suffix}</span>}
      <SaveIndicator status={status} />
    </>
  )

  // Compacte modus: zonder label, geen verticale wrap, voor inline gebruik
  // (bv. in een tabel-rij). Activeer door label leeg te laten.
  if (!label) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {inputEl}
      </span>
    )
  }

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {inputEl}
      </div>
    </div>
  )
}

function formatThousands(value) {
  if (value === '' || value == null) return ''
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return n.toLocaleString('nl-BE', { maximumFractionDigits: 0 })
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
