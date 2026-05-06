import { useEffect, useRef, useState } from 'react'
import {
  getSpotters,
  searchSpotters,
  createSpotter,
  updateSpotter,
  assignSpotter,
  unassignSpotter,
  updateAssignment,
  swapOrder,
} from '../lib/spotters'

/**
 * Spotters-sectie op AuctionPage.
 *
 * Frederik kiest bovenaan via een dropdown het aantal spotter-slots.
 * Elke slot is een rij waar hij een naam kan invoeren (met autocomplete
 * over alle globale spotters die ooit zijn ingevoerd, óók in andere
 * veilingen). Bij selectie van een bestaande spotter: de globale
 * fotonaam-info wordt hergebruikt; per-veiling-info (locatie,
 * display_order) wordt vers opgeslagen.
 *
 * Slot-aantal in dropdown is alleen UI-state — bestaande toewijzingen
 * vullen de eerste slots; lege slots staan onderaan klaar voor invoer.
 */
const SLOT_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15]

export default function SpottersField({ collectionId }) {
  const [spotters, setSpotters] = useState([])
  const [slotCount, setSlotCount] = useState(0)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSpotters(collectionId).then((list) => {
      setSpotters(list)
      // Default: minimaal zoveel slots als er spotters zijn, anders 5
      setSlotCount(Math.max(list.length, list.length === 0 ? 5 : list.length))
    })
  }, [collectionId])

  async function reload() {
    setSpotters(await getSpotters(collectionId))
  }

  function nextDisplayOrder() {
    return spotters.length > 0
      ? Math.max(...spotters.map((s) => s.display_order)) + 1
      : 0
  }

  /** Bestaande spotter selecteren (uit autocomplete) — assign aan deze veiling. */
  async function handleSelectExisting(spotter) {
    setBusy(true); setError(null)
    try {
      await assignSpotter(collectionId, spotter.id, {
        display_order: nextDisplayOrder(),
      })
      await reload()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  /** Nieuwe naam ingetypt — maak globale spotter + assign. */
  async function handleCreateNew(name) {
    if (!name?.trim()) return
    setBusy(true); setError(null)
    try {
      const created = await createSpotter({ name })
      await assignSpotter(collectionId, created.id, {
        display_order: nextDisplayOrder(),
      })
      await reload()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  async function handleUnassign(spotterId) {
    if (!window.confirm('Spotter loskoppelen van deze collectie? (blijft globaal beschikbaar)')) return
    setBusy(true); setError(null)
    try {
      await unassignSpotter(collectionId, spotterId)
      await reload()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  async function handleMove(idx, dir) {
    const target = spotters[idx + dir]
    if (!target) return
    setBusy(true); setError(null)
    try {
      await swapOrder(collectionId, spotters[idx], target)
      await reload()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  async function handleLocationChange(spotterId, location) {
    setError(null)
    try {
      await updateAssignment(collectionId, spotterId, { location })
      setSpotters((prev) => prev.map((s) =>
        s.id === spotterId ? { ...s, location } : s
      ))
    } catch (e) { setError(e.message) }
  }

  async function handleSpotterFieldChange(spotterId, field, value) {
    setError(null)
    try {
      await updateSpotter(spotterId, { [field]: value })
      setSpotters((prev) => prev.map((s) =>
        s.id === spotterId ? { ...s, [field]: value } : s
      ))
    } catch (e) { setError(e.message) }
  }

  // Render N rijen waar N = slotCount, met bestaande spotters in de
  // eerste rijen en lege slots onderaan
  const filledRows = spotters
  const emptyRowsCount = Math.max(0, slotCount - filledRows.length)
  const emptyRows = Array.from({ length: emptyRowsCount }, (_, i) => i)

  return (
    <details open style={containerStyle}>
      <summary style={summaryStyle}>
        Spotters — {filledRows.length} ingevuld
      </summary>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85em', marginTop: 8 }}>❌ {error}</p>}

      {/* Aantal-slots dropdown */}
      <div style={dropdownRowStyle}>
        <label style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>
          Aantal spotter-slots:
        </label>
        <select
          value={slotCount}
          onChange={(e) => setSlotCount(Number(e.target.value))}
          style={dropdownStyle}
        >
          {SLOT_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Bestaande gevulde rijen */}
      {filledRows.map((s, idx) => (
        <FilledRow
          key={s.id}
          spotter={s}
          isFirst={idx === 0}
          isLast={idx === filledRows.length - 1}
          onLocationChange={(v) => handleLocationChange(s.id, v)}
          onSpotterFieldChange={(field, v) => handleSpotterFieldChange(s.id, field, v)}
          onUnassign={() => handleUnassign(s.id)}
          onMoveUp={() => handleMove(idx, -1)}
          onMoveDown={() => handleMove(idx, 1)}
          disabled={busy}
        />
      ))}

      {/* Lege slots — invoer hier maakt assignment */}
      {emptyRows.map((i) => (
        <EmptyRow
          key={`empty-${i}`}
          onSelectExisting={handleSelectExisting}
          onCreateNew={handleCreateNew}
          disabled={busy}
        />
      ))}

      <p style={hintStyle}>
        Sleep niet, gebruik ↑/↓ om de volgorde links → rechts in de zaal te zetten.
        Spotters worden globaal bewaard en blijven beschikbaar voor andere veilingen.
      </p>
    </details>
  )
}

/* ----- gevulde rij ----- */

function FilledRow({
  spotter, isFirst, isLast,
  onLocationChange, onSpotterFieldChange,
  onUnassign, onMoveUp, onMoveDown, disabled,
}) {
  const [name, setName]         = useState(spotter.name)
  const [location, setLocation] = useState(spotter.location ?? '')
  const [photoUrl, setPhotoUrl] = useState(spotter.photo_url ?? '')

  // Sync wanneer parent state wijzigt
  useEffect(() => { setName(spotter.name) }, [spotter.name])
  useEffect(() => { setLocation(spotter.location ?? '') }, [spotter.location])
  useEffect(() => { setPhotoUrl(spotter.photo_url ?? '') }, [spotter.photo_url])

  return (
    <div style={rowStyle}>
      {photoUrl
        ? <img src={photoUrl} alt={name} width={40} height={40} style={photoStyle} />
        : <div style={photoPlaceholderStyle} aria-hidden>👤</div>
      }
      <input
        type="text" value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== spotter.name && onSpotterFieldChange('name', name)}
        placeholder="naam"
        style={{ ...inputStyle, flex: '1 1 8em' }}
      />
      <input
        type="text" value={location}
        onChange={(e) => setLocation(e.target.value)}
        onBlur={() => location !== (spotter.location ?? '') && onLocationChange(location)}
        placeholder="locatie (bv. links vlakbij)"
        style={{ ...inputStyle, flex: '2 1 12em' }}
      />
      <input
        type="url" value={photoUrl}
        onChange={(e) => setPhotoUrl(e.target.value)}
        onBlur={() => photoUrl !== (spotter.photo_url ?? '') && onSpotterFieldChange('photo_url', photoUrl)}
        placeholder="foto-url (optioneel)"
        style={{ ...inputStyle, flex: '1 1 12em' }}
      />
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button type="button" onClick={onMoveUp} disabled={disabled || isFirst} style={iconBtnStyle} title="Naar links">↑</button>
        <button type="button" onClick={onMoveDown} disabled={disabled || isLast} style={iconBtnStyle} title="Naar rechts">↓</button>
        <button type="button" onClick={onUnassign} disabled={disabled} style={iconBtnStyle} title="Verwijder van deze collectie">✕</button>
      </div>
    </div>
  )
}

/* ----- lege rij met autocomplete ----- */

function EmptyRow({ onSelectExisting, onCreateNew, disabled }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef(null)

  function handleChange(e) {
    const v = e.target.value
    setQuery(v)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.trim().length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchSpotters(v.trim())
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    }, 200)
  }

  async function commit() {
    const trimmed = query.trim()
    if (!trimmed) return
    // Geen suggestie expliciet aangeklikt → maak nieuwe globale spotter
    await onCreateNew(trimmed)
    setQuery('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div style={{ ...rowStyle, opacity: 0.95 }}>
      <div style={photoPlaceholderStyle} aria-hidden>👤</div>
      <div style={{ position: 'relative', flex: '1 1 8em', minWidth: 0 }}>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
          placeholder="naam — typ of kies bestaande"
          disabled={disabled}
          style={inputStyle}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul style={suggestionsStyle}>
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onSelectExisting(s); setQuery('') }}
                  style={suggestionBtnStyle}
                >
                  {s.photo_url && (
                    <img src={s.photo_url} alt="" width={20} height={20}
                      style={{ borderRadius: 'var(--radius-full)', marginRight: 6, verticalAlign: 'middle' }} />
                  )}
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ flex: '2 1 12em', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85em' }}>
        — leeg slot, vul naam in
      </div>
    </div>
  )
}

const containerStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-4)',
  marginTop: 'var(--space-5)',
}
const summaryStyle = {
  cursor: 'pointer', fontWeight: 600,
  color: 'var(--text-secondary)',
  fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase',
}
const dropdownRowStyle = {
  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
  margin: 'var(--space-3) 0 var(--space-3) 0',
}
const dropdownStyle = {
  padding: '0.35rem 0.5rem', fontSize: '0.95em',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
}
const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: 'var(--space-2) 0',
  borderBottom: '1px solid var(--border-default)',
  flexWrap: 'wrap',
}
const photoStyle = {
  objectFit: 'cover', borderRadius: 'var(--radius-full)',
  flexShrink: 0, border: '1px solid var(--border-default)',
}
const photoPlaceholderStyle = {
  width: 40, height: 40, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-full)',
  color: 'var(--text-muted)', fontSize: '1.2em',
}
const inputStyle = {
  minWidth: 0,
  padding: '0.4rem 0.5rem', fontSize: '0.95em',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
}
const iconBtnStyle = {
  padding: '0.3rem 0.55rem', background: 'transparent',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontSize: '0.95em',
}
const suggestionsStyle = {
  position: 'absolute', top: '100%', left: 0, right: 0,
  margin: '2px 0 0 0', padding: 0,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  listStyle: 'none',
  maxHeight: 200, overflowY: 'auto', zIndex: 10,
  boxShadow: 'var(--shadow-md)',
}
const suggestionBtnStyle = {
  width: '100%', textAlign: 'left',
  padding: '0.4rem 0.65rem',
  background: 'transparent', color: 'var(--text-primary)',
  border: 'none',
  cursor: 'pointer', fontSize: '0.95em',
  fontFamily: 'inherit',
}
const hintStyle = {
  color: 'var(--text-muted)', fontSize: '0.8em',
  fontStyle: 'italic', margin: 'var(--space-3) 0 0 0',
}
