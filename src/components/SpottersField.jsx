import { useEffect, useState } from 'react'
import {
  getSpotters,
  createSpotter,
  updateSpotter,
  deleteSpotter,
  swapOrder,
} from '../lib/spotters'

/**
 * Spotters-sectie op AuctionPage. Toont alle spotters voor deze veiling
 * gesorteerd op display_order (links → rechts). Per spotter: naam +
 * locatie + optionele foto-URL. ↑/↓ herorderen, ✕ verwijdert. Veld-
 * wijzigingen worden bij blur direct in de DB opgeslagen.
 */
export default function SpottersField({ auctionId }) {
  const [spotters, setSpotters] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSpotters(auctionId).then(setSpotters)
  }, [auctionId])

  async function reload() {
    setSpotters(await getSpotters(auctionId))
  }

  async function handleAdd() {
    setBusy(true); setError(null)
    try {
      const created = await createSpotter(auctionId, {})
      setSpotters((prev) => [...prev, created])
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Spotter verwijderen?')) return
    setBusy(true); setError(null)
    try {
      await deleteSpotter(id)
      setSpotters((prev) => prev.filter((s) => s.id !== id))
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  async function handleMove(idx, dir) {
    const target = spotters[idx + dir]
    if (!target) return
    setBusy(true); setError(null)
    try {
      await swapOrder(spotters[idx], target)
      await reload()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  async function handleFieldChange(id, field, value) {
    setError(null)
    try {
      await updateSpotter(id, { [field]: value })
      setSpotters((prev) =>
        prev.map((s) => s.id === id ? { ...s, [field]: value } : s)
      )
    } catch (e) { setError(e.message) }
  }

  return (
    <details open style={containerStyle}>
      <summary style={summaryStyle}>
        Spotters — {spotters.length} {spotters.length === 1 ? 'persoon' : 'personen'}
      </summary>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.85em', marginTop: 8 }}>❌ {error}</p>}

      {spotters.length === 0 && (
        <p style={emptyStyle}>
          Nog geen spotters toegevoegd. Klik hieronder om de eerste te plaatsen
          (volgorde van links naar rechts in de zaal).
        </p>
      )}

      {spotters.length > 0 && (
        <ul style={listStyle}>
          {spotters.map((s, idx) => (
            <SpotterRow
              key={s.id}
              spotter={s}
              isFirst={idx === 0}
              isLast={idx === spotters.length - 1}
              onChange={handleFieldChange}
              onMoveUp={() => handleMove(idx, -1)}
              onMoveDown={() => handleMove(idx, 1)}
              onDelete={() => handleDelete(s.id)}
              disabled={busy}
            />
          ))}
        </ul>
      )}

      <button
        type="button" onClick={handleAdd} disabled={busy}
        style={addBtnStyle}
      >
        + Spotter toevoegen
      </button>

      <p style={hintStyle}>
        Gebruik de ↑/↓-knoppen om de volgorde links → rechts in de zaal te zetten.
        De cockpit toont de namen op die volgorde tijdens het veilen.
      </p>
    </details>
  )
}

function SpotterRow({ spotter, isFirst, isLast, onChange, onMoveUp, onMoveDown, onDelete, disabled }) {
  const [name, setName]         = useState(spotter.name)
  const [location, setLocation] = useState(spotter.location ?? '')
  const [photoUrl, setPhotoUrl] = useState(spotter.photo_url ?? '')

  return (
    <li style={rowStyle}>
      {photoUrl
        ? <img src={photoUrl} alt={name} width={40} height={40} style={photoStyle} />
        : <div style={photoPlaceholderStyle} aria-hidden>👤</div>
      }
      <input
        type="text" value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== spotter.name && onChange(spotter.id, 'name', name)}
        placeholder="naam"
        style={{ ...inputStyle, flex: '1 1 8em' }}
      />
      <input
        type="text" value={location}
        onChange={(e) => setLocation(e.target.value)}
        onBlur={() => location !== (spotter.location ?? '') && onChange(spotter.id, 'location', location)}
        placeholder="locatie (bv. links vlakbij)"
        style={{ ...inputStyle, flex: '2 1 12em' }}
      />
      <input
        type="url" value={photoUrl}
        onChange={(e) => setPhotoUrl(e.target.value)}
        onBlur={() => photoUrl !== (spotter.photo_url ?? '') && onChange(spotter.id, 'photo_url', photoUrl)}
        placeholder="foto-url (optioneel)"
        style={{ ...inputStyle, flex: '1 1 12em' }}
      />
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button type="button" onClick={onMoveUp} disabled={disabled || isFirst} style={iconBtnStyle} title="Naar links">↑</button>
        <button type="button" onClick={onMoveDown} disabled={disabled || isLast} style={iconBtnStyle} title="Naar rechts">↓</button>
        <button type="button" onClick={onDelete} disabled={disabled} style={iconBtnStyle} title="Verwijder">✕</button>
      </div>
    </li>
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
const emptyStyle = {
  color: 'var(--text-muted)', fontStyle: 'italic',
  margin: 'var(--space-3) 0',
}
const listStyle = { listStyle: 'none', padding: 0, margin: 'var(--space-3) 0 var(--space-3) 0' }
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
  fontFamily: 'inherit',
}
const iconBtnStyle = {
  padding: '0.3rem 0.55rem', background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontSize: '0.95em',
}
const addBtnStyle = {
  marginTop: 'var(--space-2)', padding: '0.4rem 0.85rem',
  background: 'transparent', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
}
const hintStyle = {
  color: 'var(--text-muted)', fontSize: '0.8em',
  fontStyle: 'italic', margin: 'var(--space-3) 0 0 0',
}
