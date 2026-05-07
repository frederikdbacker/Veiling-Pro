import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Breadcrumbs from '../components/Breadcrumbs'
import AutoSaveText from '../components/AutoSaveText'
import AutoSaveUrl from '../components/AutoSaveUrl'
import CountryAutocomplete from '../components/CountryAutocomplete'
import CommitteeSection from '../components/CommitteeSection'

export default function HousePage() {
  const { houseId } = useParams()
  const [house, setHouse] = useState(null)
  const [collections, setCollections] = useState([])
  const [status, setStatus] = useState('Laden…')
  const [editingMeta, setEditingMeta] = useState(false)
  const [addingCollection, setAddingCollection] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    const [houseRes, collectionsRes] = await Promise.all([
      supabase.from('auction_houses').select('*').eq('id', houseId).single(),
      supabase.from('collections').select('*').eq('house_id', houseId)
        .order('date', { ascending: false, nullsFirst: false }),
    ])
    if (houseRes.error) { setStatus(`Fout: ${houseRes.error.message}`); return }
    if (collectionsRes.error) { setStatus(`Fout: ${collectionsRes.error.message}`); return }
    setHouse(houseRes.data)
    setCollections(collectionsRes.data)
    setStatus(`${collectionsRes.data.length} veilingen`)
  }

  useEffect(() => { load() }, [houseId])

  // Lot-zoekfunctie binnen alle collecties van dit huis
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!search.trim() || collections.length === 0) {
      setSearchResults(null)
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      const collIds = collections.map((c) => c.id)
      const { data, error } = await supabase
        .from('lots')
        .select('id, number, name, collection_id, collections(name)')
        .in('collection_id', collIds)
        .ilike('name', `%${search.trim()}%`)
        .order('name')
        .limit(100)
      if (!error) setSearchResults(data ?? [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [search, collections])

  async function handleAddCollection(payload) {
    setError(null)
    const { error } = await supabase.from('collections').insert({ ...payload, house_id: houseId })
    if (error) { setError(error.message); return false }
    setAddingCollection(false)
    await load()
    return true
  }

  return (
    <section>
      <Breadcrumbs trail={[
        { label: 'Veilinghuizen', to: '/' },
        { label: house?.name ?? 'Veilinghuis' },
      ]} />
      <h1 style={{ color: 'var(--text-primary)' }}>{house?.name ?? 'Veilinghuis'}</h1>
      <p style={{ color: 'var(--text-secondary)' }}>{status}</p>

      {error && <p style={{ color: 'var(--danger)' }}>❌ {error}</p>}

      {house && (
        <div style={{ marginBottom: 'var(--space-4)', maxWidth: 540 }}>
          <button
            onClick={() => setEditingMeta((v) => !v)}
            style={toggleBtnStyle}
          >
            {editingMeta ? '▴ Inklappen' : '▾ Bewerk veilinghuis'}
          </button>

          {editingMeta && (
            <div style={metaPanelStyle}>
              <AutoSaveText
                table="auction_houses" id={house.id} fieldName="name"
                initialValue={house.name} label="Naam"
                onSaved={(v) => setHouse((p) => ({ ...p, name: v }))}
              />
              <CountryAutoSaveRow
                houseId={house.id}
                initialValue={house.country}
                onSaved={(v) => setHouse((p) => ({ ...p, country: v }))}
              />
              <AutoSaveUrl
                table="auction_houses" id={house.id} fieldName="website"
                initialValue={house.website} label="Website"
                placeholder="https://..."
                onSaved={(v) => setHouse((p) => ({ ...p, website: v }))}
              />
              <AutoSaveText
                table="auction_houses" id={house.id} fieldName="contact"
                initialValue={house.contact} label="Contact"
                placeholder="e-mail of telefoon"
                onSaved={(v) => setHouse((p) => ({ ...p, contact: v }))}
              />
              <AutoSaveUrl
                table="auction_houses" id={house.id} fieldName="logo_url"
                initialValue={house.logo_url} label="Logo-URL (voor 'Auction page'-link in cockpit)"
                placeholder="https://.../logo.png — wit-zwart, transparante achtergrond"
                onSaved={(v) => setHouse((p) => ({ ...p, logo_url: v }))}
              />
              {house.logo_url && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>Voorbeeld: </span>
                  <img src={house.logo_url} alt="Logo" style={{ height: 24, marginLeft: 8, verticalAlign: 'middle', background: '#fff', padding: '2px 6px', borderRadius: 4 }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {house && <CommitteeSection houseId={house.id} />}

      <h2 style={subheadStyle}>Lots zoeken</h2>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Zoek op lot-naam binnen dit veilinghuis…"
        style={{
          width: '100%', maxWidth: 480,
          padding: '8px 12px',
          background: 'var(--bg-input, #1a1a1a)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'inherit', fontSize: '0.95em',
          marginBottom: 'var(--space-3)',
        }}
      />
      {searching && <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>zoeken…</p>}
      {searchResults && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          {searchResults.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Geen lots gevonden voor "{search}".
            </p>
          ) : (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', marginBottom: 'var(--space-2)' }}>
                {searchResults.length} resultaat{searchResults.length !== 1 ? 'en' : ''}{searchResults.length === 100 ? ' (top 100)' : ''}:
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {searchResults.map((lot) => (
                  <li key={lot.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-default)' }}>
                    <Link to={`/lots/${lot.id}`} style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>#{lot.number ?? '—'}</span>
                      <strong>{lot.name}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', marginLeft: 8 }}>
                        in {lot.collections?.name ?? '—'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <h2 style={subheadStyle}>Veilingen</h2>

      {!addingCollection ? (
        <button onClick={() => setAddingCollection(true)} style={addBtnStyle}>
          + Veiling toevoegen
        </button>
      ) : (
        <AddCollectionForm
          onSave={handleAddCollection}
          onCancel={() => setAddingCollection(false)}
        />
      )}

      {collections.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {collections.map((a) => (
            <li key={a.id} style={{
              padding: 'var(--space-3) 0',
              borderBottom: '1px solid var(--border-default)',
            }}>
              <Link
                to={`/collections/${a.id}`}
                style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }}
              >
                {a.name}
              </Link>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9em', marginTop: '0.25rem' }}>
                {formatDate(a.date)}
                {a.location && ` — ${a.location}`}
                {a.status && ` — ${a.status}`}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Nog geen veilingen voor dit huis. Klik op "+ Veiling toevoegen" om er één aan te maken.
        </p>
      )}
    </section>
  )
}

function CountryAutoSaveRow({ houseId, initialValue, onSaved }) {
  const [value, setValue] = useState(initialValue ?? '')
  const [status, setStatus] = useState('idle')

  async function commit(v) {
    if (v === (initialValue ?? '')) { setStatus('idle'); return }
    setStatus('saving')
    const { error } = await supabase
      .from('auction_houses')
      .update({ country: v.trim() || null })
      .eq('id', houseId)
    if (error) { setStatus('error'); return }
    setStatus('saved')
    if (onSaved) onSaved(v.trim() || null)
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.9em' }}>Land</label>
      <CountryAutocomplete
        value={value}
        onChange={(v) => { setValue(v); setStatus('pending') }}
        onBlur={() => commit(value)}
        placeholder="typ 'Be' → België, 'Ne' → Nederland, …"
      />
      {status === 'pending' && <small style={{ color: 'var(--text-muted)', marginLeft: 6 }}>typen…</small>}
      {status === 'saving'  && <small style={{ color: 'var(--text-muted)', marginLeft: 6 }}>opslaan…</small>}
      {status === 'saved'   && <small style={{ color: 'var(--success)',     marginLeft: 6 }}>💾 opgeslagen</small>}
      {status === 'error'   && <small style={{ color: 'var(--danger)',      marginLeft: 6 }}>❌ fout</small>}
    </div>
  )
}

function AddCollectionForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const payload = {
      name: name.trim(),
      date: date || null,
      location: location.trim() || null,
      time_auction_start: timeStart && date ? new Date(`${date}T${timeStart}`).toISOString() : null,
    }
    const ok = await onSave(payload)
    setBusy(false)
    if (ok) {
      setName(''); setDate(''); setLocation(''); setTimeStart('')
    }
  }

  return (
    <form onSubmit={submit} style={formStyle}>
      <input
        autoFocus type="text" placeholder="Naam (bv. Aloga Auction 2026)"
        value={name} onChange={(e) => setName(e.target.value)}
        style={formInputStyle}
      />
      <input
        type="date"
        value={date} onChange={(e) => setDate(e.target.value)}
        style={formInputStyle}
      />
      <input
        type="text" placeholder="Locatie (bv. Sentower Park)"
        value={location} onChange={(e) => setLocation(e.target.value)}
        style={formInputStyle}
      />
      <input
        type="time" placeholder="Starttijd"
        value={timeStart} onChange={(e) => setTimeStart(e.target.value)}
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

function formatDate(d) {
  if (!d) return '(datum onbekend)'
  return new Date(d).toLocaleDateString('nl-BE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const toggleBtnStyle = {
  padding: '6px 12px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9em',
  marginBottom: 'var(--space-2)',
}
const metaPanelStyle = {
  padding: 'var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
}
const subheadStyle = {
  fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--text-secondary)', fontWeight: 600,
  marginTop: 'var(--space-5)', marginBottom: 'var(--space-3)',
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
  background: 'transparent', color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit',
}
