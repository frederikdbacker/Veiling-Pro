import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllClients, updateClient, createClient, deleteClient } from '../lib/clients'
import { supabase } from '../lib/supabase'
import Breadcrumbs from '../components/Breadcrumbs'
import CountrySelect from '../components/CountrySelect'
import PhotoUpload from '../components/PhotoUpload'

/**
 * Globale klantenlijst-overzichtspagina (#22 uit POST_ALOGA_ROADMAP.md).
 *
 * Toont alle klanten over alle veilinghuizen heen. Inline bewerkbaar:
 *   - Naam (klik op cel, type, blur saves)
 *   - Land (CountrySelect)
 *   - Foto (PhotoUpload — bucket client-photos)
 *
 * Plus zoekveld + huis-filter.
 *
 * Route: /clients
 */
export default function ClientsPage() {
  const [clients, setClients] = useState([])
  const [houses, setHouses] = useState([])
  const [filterHouse, setFilterHouse] = useState('')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [list, housesRes] = await Promise.all([
      listAllClients(),
      supabase.from('auction_houses').select('id, name').order('name'),
    ])
    setClients(list)
    setHouses(housesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let result = clients
    if (filterHouse) result = result.filter((c) => c.house_id === filterHouse)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((c) => c.name.toLowerCase().includes(q))
    }
    return result
  }, [clients, filterHouse, search])

  async function handlePatch(clientId, patch) {
    setError(null)
    try {
      await updateClient(clientId, patch)
      setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, ...patch } : c))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleAdd(name, houseId, countryCode) {
    if (!name.trim() || !houseId) return
    setError(null)
    try {
      await createClient(houseId, name, { country_code: countryCode })
      setAdding(false)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDelete(client) {
    if (!window.confirm(
      `Klant "${client.name}" definitief verwijderen?\n\n` +
      `Dit kan mislukken als de klant nog gekoppeld is aan lots of seating ` +
      `in een collectie. Verwijder die koppelingen eerst.`
    )) return
    setError(null)
    try {
      await deleteClient(client.id)
      setClients((prev) => prev.filter((c) => c.id !== client.id))
    } catch (e) {
      setError(`Verwijderen mislukt: ${e.message}`)
    }
  }

  return (
    <section>
      <Breadcrumbs trail={[
        { label: 'Veilinghuizen', to: '/' },
        { label: 'Alle klanten' },
      ]} />
      <h1>Klanten</h1>

      {error && <p style={{ color: 'var(--danger)' }}>❌ {error}</p>}

      <div style={toolbarStyle}>
        <input
          type="text" placeholder="Zoek op naam…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={searchInputStyle}
        />
        <select
          value={filterHouse} onChange={(e) => setFilterHouse(e.target.value)}
          style={filterStyle}
        >
          <option value="">Alle veilinghuizen</option>
          {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <button onClick={() => setAdding(true)} style={addBtnStyle}>+ Klant toevoegen</button>
      </div>

      {adding && (
        <AddClientForm
          houses={houses}
          defaultHouseId={filterHouse || null}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Klanten laden…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {clients.length === 0 ? 'Nog geen klanten.' : 'Geen klanten gevonden voor deze filter.'}
        </p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85em' }}>
              <th style={{ padding: '8px 4px', width: 60 }}>Foto</th>
              <th style={{ padding: '8px 4px' }}>Naam</th>
              <th style={{ padding: '8px 4px', width: 240 }}>Land</th>
              <th style={{ padding: '8px 4px' }}>Veilinghuis</th>
              <th style={{ padding: '8px 4px', width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <ClientRow
                key={client.id}
                client={client}
                onPatch={(patch) => handlePatch(client.id, patch)}
                onDelete={() => handleDelete(client)}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function ClientRow({ client, onPatch, onDelete }) {
  const [name, setName] = useState(client.name)

  return (
    <tr style={rowStyle}>
      <td style={cellStyle}>
        <PhotoUpload
          ownerId={client.id}
          pathPrefix="clients"
          currentUrl={client.photo_url}
          onUploaded={(url) => onPatch({ photo_url: url })}
          onCleared={() => onPatch({ photo_url: null })}
        />
      </td>
      <td style={cellStyle}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim()
            if (trimmed && trimmed !== client.name) onPatch({ name: trimmed })
            else if (!trimmed) setName(client.name)
          }}
          style={inlineInputStyle}
        />
      </td>
      <td style={cellStyle}>
        <CountrySelect
          value={client.country_code}
          onChange={(code) => onPatch({ country_code: code })}
        />
      </td>
      <td style={cellStyle}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>
          {client.auction_houses?.name ?? '—'}
        </span>
      </td>
      <td style={cellStyle}>
        <button
          onClick={onDelete}
          title="Klant verwijderen"
          aria-label="Klant verwijderen"
          style={deleteBtnStyle}
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

function AddClientForm({ houses, defaultHouseId, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [houseId, setHouseId] = useState(defaultHouseId ?? (houses[0]?.id ?? ''))
  const [countryCode, setCountryCode] = useState(null)
  const [busy, setBusy] = useState(false)

  return (
    <div style={addFormStyle}>
      <input
        autoFocus type="text" placeholder="Naam"
        value={name} onChange={(e) => setName(e.target.value)}
        style={{ ...inlineInputStyle, flex: 1, minWidth: 200 }}
      />
      <select value={houseId} onChange={(e) => setHouseId(e.target.value)} style={filterStyle}>
        {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
      </select>
      <CountrySelect value={countryCode} onChange={setCountryCode} />
      <button
        onClick={async () => { setBusy(true); await onSave(name, houseId, countryCode); setBusy(false) }}
        disabled={busy || !name.trim() || !houseId}
        style={addBtnStyle}
      >
        {busy ? 'Bewaren…' : 'Bewaar'}
      </button>
      <button onClick={onCancel} disabled={busy} style={cancelBtnStyle}>Annuleer</button>
    </div>
  )
}

const toolbarStyle = {
  display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
  marginBottom: 'var(--space-3)',
}
const searchInputStyle = {
  flex: 1, minWidth: 200, maxWidth: 320,
  padding: '6px 10px',
  background: 'var(--bg-input, #1a1a1a)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', fontFamily: 'inherit',
}
const filterStyle = {
  padding: '6px 8px',
  background: 'var(--bg-input, #1a1a1a)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', fontFamily: 'inherit',
}
const addBtnStyle = {
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
const addFormStyle = {
  display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
  padding: 'var(--space-3)', marginBottom: 'var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
}
const tableStyle = {
  width: '100%', borderCollapse: 'collapse',
}
const rowStyle = {
  borderTop: '1px solid var(--border-default)',
}
const cellStyle = {
  padding: '8px 4px', verticalAlign: 'middle',
}
const deleteBtnStyle = {
  padding: '4px 8px',
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-muted)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.85em',
}
const inlineInputStyle = {
  width: '100%',
  padding: '6px 8px',
  background: 'var(--bg-input, #1a1a1a)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.95em',
}
