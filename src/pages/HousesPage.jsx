import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CountryAutocomplete from '../components/CountryAutocomplete'
import Modal from '../components/Modal'
import { setHouseArchived, deleteHouse, getHouseContents } from '../lib/houses'

export default function HousesPage() {
  const [status, setStatus] = useState('Laden…')
  const [houses, setHouses] = useState([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const [managing, setManaging] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [confirmHouse, setConfirmHouse] = useState(null) // { house, contents } voor de verwijder-bevestiging
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase
      .from('auction_houses')
      .select('*')
      .order('name')
    if (error) {
      setStatus(`Fout bij ophalen: ${error.message}`)
      return
    }
    setStatus(`${data.length} veilinghuizen`)
    setHouses(data)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(payload) {
    setError(null)
    const { error } = await supabase.from('auction_houses').insert(payload)
    if (error) {
      setError(error.message)
      return false
    }
    setAdding(false)
    await load()
    return true
  }

  async function archiveHouse(h, archived) {
    setError(null)
    try {
      await setHouseArchived(h.id, archived)
      setHouses((prev) => prev.map((x) => (x.id === h.id ? { ...x, archived } : x)))
    } catch (e) { setError(e.message) }
  }

  // Stap 1: tel inhoud op en open de bevestig-modal. Stap 2: echt verwijderen.
  async function askDeleteHouse(h) {
    setError(null)
    try {
      const contents = await getHouseContents(h.id)
      setConfirmHouse({ house: h, contents })
    } catch (e) { setError(e.message) }
  }
  async function confirmDeleteHouse() {
    if (!confirmHouse) return
    setBusy(true)
    try {
      await deleteHouse(confirmHouse.house.id)
      setConfirmHouse(null)
      await load()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const visibleHouses = houses.filter((h) => showArchived || !h.archived)

  return (
    <section>
      <h1 style={{ color: 'var(--text-primary)' }}>Veilinghuizen</h1>
      <p style={{ color: 'var(--text-secondary)' }}>{status}</p>
      {error && <p style={{ color: 'var(--danger)' }}>❌ {error}</p>}

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
        {!adding && (
          <button onClick={() => setAdding(true)} style={addBtnStyle}>
            + Veilinghuis toevoegen
          </button>
        )}
        <button
          onClick={() => { setManaging((v) => !v); setError(null) }}
          style={managing ? { ...manageBtnStyle, borderColor: 'var(--accent)', color: 'var(--accent)' } : manageBtnStyle}
        >
          🗂 {managing ? 'Klaar met beheren' : 'Beheren'}
        </button>
        <Link to="/clients" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, marginLeft: 'auto' }}>
          👥 Alle klanten →
        </Link>
      </div>

      {adding && <AddHouseForm onSave={handleAdd} onCancel={() => setAdding(false)} />}

      {managing && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: '0.9em' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Toon gearchiveerd ({houses.filter((h) => h.archived).length})
        </label>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-3)',
      }}>
        {visibleHouses.map((h) => (
          <HouseCard
            key={h.id}
            house={h}
            managing={managing}
            onArchive={() => archiveHouse(h, true)}
            onRestore={() => archiveHouse(h, false)}
            onDelete={() => askDeleteHouse(h)}
          />
        ))}
      </div>

      {confirmHouse && (
        <Modal onClose={() => !busy && setConfirmHouse(null)} maxWidth={460}>
          <h2 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Veilinghuis verwijderen?</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Je staat op het punt <strong>{confirmHouse.house.name}</strong> definitief te
            verwijderen, inclusief <strong>{confirmHouse.contents.collectionCount} veiling(en)</strong> en{' '}
            <strong>{confirmHouse.contents.lotCount} lot(s)</strong>. Dit kan <strong>niet</strong> ongedaan
            gemaakt worden.
          </p>
          {confirmHouse.contents.collectionCount > 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>
              Tip: gebruik liever <em>Archiveren</em> als je de data wil bewaren.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-3)' }}>
            <button type="button" onClick={confirmDeleteHouse} disabled={busy}
              style={{ padding: '8px 16px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {busy ? 'Verwijderen…' : 'Definitief verwijderen'}
            </button>
            <button type="button" onClick={() => setConfirmHouse(null)} disabled={busy} style={cancelBtnStyle}>
              Annuleer
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

function HouseCard({ house: h, managing, onArchive, onRestore, onDelete }) {
  const cardInner = (
    <>
      <div style={{
        width: '100%', aspectRatio: '3/2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}>
        {h.logo_url ? (
          <img src={h.logo_url} alt={`${h.name} logo`} style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} />
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>(geen logo)</span>
        )}
      </div>
      <div style={{ fontWeight: 600, textAlign: 'center', fontSize: '0.95em' }}>
        {h.name}{h.archived && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · gearchiveerd</span>}
      </div>
    </>
  )
  const baseCardStyle = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
    padding: 'var(--space-3)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none', color: 'var(--text-primary)',
    opacity: h.archived ? 0.55 : 1,
  }

  // In beheer-modus is de kaart niet klikbaar (geen navigatie), maar toont ze actie-knoppen.
  if (managing) {
    return (
      <div style={baseCardStyle}>
        {cardInner}
        <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 'var(--space-1)' }}>
          {h.archived ? (
            <button type="button" onClick={onRestore} style={cardActionStyle(false)}>↩ Herstellen</button>
          ) : (
            <button type="button" onClick={onArchive} style={cardActionStyle(false)}>🗂 Archiveren</button>
          )}
          <button type="button" onClick={onDelete} style={cardActionStyle(true)}>🗑 Verwijderen</button>
        </div>
      </div>
    )
  }

  return (
    <Link
      to={`/houses/${h.id}`}
      style={{ ...baseCardStyle, transition: 'border-color 120ms, transform 120ms' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
    >
      {cardInner}
    </Link>
  )
}

function AddHouseForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [website, setWebsite] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const ok = await onSave({
      name: name.trim(),
      country: country.trim() || null,
      website: website.trim() || null,
      contact: contact.trim() || null,
    })
    setBusy(false)
    if (ok) {
      setName(''); setCountry(''); setWebsite(''); setContact('')
    }
  }

  return (
    <form onSubmit={submit} style={formStyle}>
      <input
        autoFocus type="text" placeholder="Naam (verplicht, bv. Zangersheide)"
        value={name} onChange={(e) => setName(e.target.value)}
        style={formInputStyle}
      />
      <CountryAutocomplete
        value={country}
        onChange={setCountry}
        placeholder="Land (typ bv. 'Be' → België)"
        style={formInputStyle}
      />
      <input
        type="url" placeholder="Website (https://...)"
        value={website} onChange={(e) => setWebsite(e.target.value)}
        style={formInputStyle}
      />
      <input
        type="text" placeholder="Contact (e-mail of telefoon, optioneel)"
        value={contact} onChange={(e) => setContact(e.target.value)}
        style={formInputStyle}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={busy || !name.trim()} style={confirmBtnStyle}>
          {busy ? 'Bewaren…' : 'Bewaar'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} style={cancelBtnStyle}>
          Annuleer
        </button>
      </div>
    </form>
  )
}

const addBtnStyle = {
  padding: '8px 16px',
  background: 'transparent', color: 'var(--accent)',
  border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const manageBtnStyle = {
  padding: '8px 16px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const cardActionStyle = (danger) => ({
  flex: 1, padding: '4px 6px',
  background: 'transparent',
  color: danger ? 'var(--danger)' : 'var(--accent)',
  border: `1px solid ${danger ? 'var(--danger)' : 'var(--accent)'}`,
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.8em', cursor: 'pointer', fontFamily: 'inherit',
})
const formStyle = {
  display: 'flex', flexDirection: 'column', gap: 8,
  padding: 'var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  marginBottom: 'var(--space-3)',
  maxWidth: 480,
}
const formInputStyle = {
  padding: '6px 10px',
  background: 'var(--bg-input, #1a1a1a)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit', fontSize: '0.95em',
}
const confirmBtnStyle = {
  padding: '6px 14px',
  background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const cancelBtnStyle = {
  padding: '6px 14px',
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit',
}
