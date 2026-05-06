import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Klikbare 5-sterren rating met auto-save naar lots.rating.
 *
 * - Klik op een ster → die rating opslaan
 * - Klik nogmaals op de huidige rating → wist 'm (rating = null)
 * - Hover toont preview van de waarde
 * - readOnly: enkel weergave, geen interactie
 *
 * Props:
 *   lotId         UUID van het lot
 *   initialValue  huidige lot.rating (1-5 of null)
 *   onSaved(val)  callback na succesvolle save (optional)
 *   readOnly      true → geen klikken/hover
 *   size          CSS font-size voor de sterren (default '1.2em')
 */
export default function StarRating({ lotId, initialValue, onSaved, readOnly = false, size = '1.2em' }) {
  const [value, setValue] = useState(initialValue ?? 0)
  const [hover, setHover] = useState(0)
  const [saving, setSaving] = useState(false)

  // Sync bij prop-wissel (bv. ander lot in cockpit)
  useEffect(() => { setValue(initialValue ?? 0) }, [initialValue])

  const display = hover || value

  async function handleClick(n) {
    if (readOnly || saving) return
    const newValue = n === value ? null : n
    const previous = value
    setValue(newValue ?? 0)
    setHover(0) // reset preview zodat de visuele waarde echt verandert
    setSaving(true)
    const { error } = await supabase
      .from('lots')
      .update({ rating: newValue })
      .eq('id', lotId)
    setSaving(false)
    if (error) {
      setValue(previous)
      alert(`Rating opslaan mislukt: ${error.message}`)
      return
    }
    if (onSaved) onSaved(newValue)
  }

  return (
    <div
      onMouseLeave={() => !readOnly && setHover(0)}
      style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}
      role="group"
      aria-label="Sterrenrating"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClick(n) }}
          onMouseEnter={() => !readOnly && setHover(n)}
          disabled={readOnly || saving}
          aria-label={`${n} ster${n > 1 ? 'ren' : ''}`}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: readOnly || saving ? 'default' : 'pointer',
            fontSize: size,
            lineHeight: 1,
            color: n <= display ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          {n <= display ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}
