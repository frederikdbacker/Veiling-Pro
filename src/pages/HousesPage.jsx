import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CountryAutocomplete from '../components/CountryAutocomplete'

export default function HousesPage() {
  const [status, setStatus] = useState('Laden…')
  const [houses, setHouses] = useState([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

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

  return (
    <section>
      <h1 style={{ color: 'var(--text-primary)' }}>Veilinghuizen</h1>
      <p style={{ color: 'var(--text-secondary)' }}>{status}</p>
      <p style={{ marginBottom: 'var(--space-3)' }}>
        <Link to="/clients" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          👥 Alle klanten →
        </Link>
      </p>

      {error && <p style={{ color: 'var(--danger)' }}>❌ {error}</p>}

      {!adding ? (
        <button onClick={() => setAdding(true)} style={addBtnStyle}>
          + Veilinghuis toevoegen
        </button>
      ) : (
        <AddHouseForm onSave={handleAdd} onCancel={() => setAdding(false)} />
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-3)',
      }}>
        {houses.map((h) => (
          <Link
            key={h.id}
            to={`/houses/${h.id}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              color: 'var(--text-primary)',
              transition: 'border-color 120ms, transform 120ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
          >
            <div style={{
              width: '100%', aspectRatio: '3/2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}>
              {h.logo_url ? (
                <img
                  src={h.logo_url} alt={`${h.name} logo`}
                  style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>(geen logo)</span>
              )}
            </div>
            <div style={{ fontWeight: 600, textAlign: 'center', fontSize: '0.95em' }}>
              {h.name}
            </div>
          </Link>
        ))}
      </div>
    </section>
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
  background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  marginBottom: 'var(--space-3)',
}
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
