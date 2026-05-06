import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STUDBOOKS } from '../lib/studbooks'

/**
 * Hengst-keuring per lot — vinkje + multi-select stamboeken via chips.
 * Alleen bedoeld om gerenderd te worden bij lots met gender = hengst
 * (voorwaarde wordt opgelegd door de aanroeper).
 *
 * Props:
 *   lotId               UUID van het lot
 *   currentApproved     bool — huidige stallion_approved
 *   currentStudbooks    text[] — huidige approved_studbooks
 *   onSaved(patch)      callback met de patch die is doorgevoerd
 *   inline              true → compacte inline-render (span, "ggk"-label,
 *                       kleine chips). false → block-layout (default).
 */
export default function StallionApprovalField({ lotId, currentApproved, currentStudbooks, onSaved, inline = false }) {
  const [approved, setApproved] = useState(!!currentApproved)
  const [studbooks, setStudbooks] = useState(Array.isArray(currentStudbooks) ? currentStudbooks : [])
  const [saving, setSaving] = useState(false)

  useEffect(() => { setApproved(!!currentApproved) }, [currentApproved])
  useEffect(() => {
    setStudbooks(Array.isArray(currentStudbooks) ? currentStudbooks : [])
  }, [currentStudbooks])

  async function save(patch) {
    setSaving(true)
    const { error } = await supabase.from('lots').update(patch).eq('id', lotId)
    setSaving(false)
    if (error) {
      alert(`Opslaan mislukt: ${error.message}`)
      return false
    }
    if (onSaved) onSaved(patch)
    return true
  }

  async function handleToggle(e) {
    const next = e.target.checked
    setApproved(next)
    if (!next) {
      // Bij uitvinken: stamboeken meteen leeg
      setStudbooks([])
      await save({ stallion_approved: false, approved_studbooks: [] })
    } else {
      await save({ stallion_approved: true })
    }
  }

  async function handleAdd(e) {
    const sb = e.target.value
    e.target.value = ''
    if (!sb || studbooks.includes(sb)) return
    const next = [...studbooks, sb]
    setStudbooks(next)
    await save({ approved_studbooks: next })
  }

  async function handleRemove(sb) {
    const next = studbooks.filter((s) => s !== sb)
    setStudbooks(next)
    await save({ approved_studbooks: next })
  }

  const available = STUDBOOKS.filter((s) => !studbooks.includes(s))

  if (inline) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={approved}
            onChange={handleToggle}
            disabled={saving}
            style={{ margin: 0 }}
          />
          ggk
        </label>
        {approved && studbooks.map((sb) => (
          <span key={sb} style={inlineChipStyle}>
            {sb}
            <button
              type="button"
              onClick={() => handleRemove(sb)}
              disabled={saving}
              aria-label={`Verwijder ${sb}`}
              style={chipRemoveStyle}
            >
              ✕
            </button>
          </span>
        ))}
        {approved && available.length > 0 && (
          <select
            onChange={handleAdd}
            disabled={saving}
            value=""
            style={inlineAddSelectStyle}
            aria-label="Stamboek toevoegen"
          >
            <option value="">+ stamboek</option>
            {available.map((sb) => <option key={sb} value={sb}>{sb}</option>)}
          </select>
        )}
      </span>
    )
  }

  return (
    <div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={approved}
          onChange={handleToggle}
          disabled={saving}
        />
        Gekeurd
      </label>
      {approved && (
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {studbooks.map((sb) => (
            <span key={sb} style={chipStyle}>
              {sb}
              <button
                type="button"
                onClick={() => handleRemove(sb)}
                disabled={saving}
                aria-label={`Verwijder ${sb}`}
                style={chipRemoveStyle}
              >
                ✕
              </button>
            </span>
          ))}
          {available.length > 0 && (
            <select
              onChange={handleAdd}
              disabled={saving}
              value=""
              style={addSelectStyle}
              aria-label="Stamboek toevoegen"
            >
              <option value="">+ stamboek toevoegen…</option>
              {available.map((sb) => <option key={sb} value={sb}>{sb}</option>)}
            </select>
          )}
          {studbooks.length === 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', fontStyle: 'italic' }}>
              nog geen stamboek geselecteerd
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 4px 2px 8px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.85em',
  fontWeight: 600,
  letterSpacing: '0.04em',
  color: 'var(--text-primary)',
}
const chipRemoveStyle = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.85em',
  padding: '0 2px',
  lineHeight: 1,
}
const addSelectStyle = {
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.85em',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const inlineChipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '1px 3px 1px 6px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.75em',
  fontWeight: 600,
  letterSpacing: '0.04em',
  color: 'var(--text-primary)',
}
const inlineAddSelectStyle = {
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  padding: '1px 4px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.75em',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
