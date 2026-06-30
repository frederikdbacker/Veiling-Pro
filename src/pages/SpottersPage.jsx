import { useEffect, useMemo, useState } from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import PhotoUpload from '../components/PhotoUpload'
import { supabase } from '../lib/supabase'
import {
  listSpottersWithHouses,
  createSpotter,
  updateSpotter,
  assignSpottersToCollection,
} from '../lib/spotters'

/**
 * Globale spotterspool-pagina (B1 uit ROADMAP_2026-06-30).
 *
 * - Fotokaarten met inline-bewerkbare naam + foto-upload (Supabase Storage,
 *   bucket client-photos, subfolder spotters/ — hergebruikt PhotoUpload).
 * - Zoek op naam + filter per veilinghuis. Het huisfilter is AFGELEID uit
 *   historie: een spotter "hoort bij" een huis als hij ooit aan een collectie
 *   van dat huis was toegewezen (collection_spotters -> collections.house_id).
 * - Spotters aanvinken -> in één keer aan een gekozen veiling toevoegen.
 *
 * Route: /spotters
 */
export default function SpottersPage() {
  const [spotters, setSpotters] = useState([])
  const [collections, setCollections] = useState([])
  const [search, setSearch] = useState('')
  const [filterHouse, setFilterHouse] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [targetCollectionId, setTargetCollectionId] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [list, collRes] = await Promise.all([
      listSpottersWithHouses(),
      supabase
        .from('collections')
        .select('id, name, date, archived, auction_houses ( id, name )')
        .order('date', { ascending: false }),
    ])
    setSpotters(list)
    setCollections((collRes.data ?? []).filter((c) => !c.archived))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Huizen voor het filter: alle huizen die in de afgeleide historie voorkomen.
  const houseOptions = useMemo(() => {
    const m = new Map()
    for (const s of spotters) for (const h of s.houses) m.set(h.id, h.name)
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'nl'))
  }, [spotters])

  const filtered = useMemo(() => {
    let result = spotters
    if (filterHouse) result = result.filter((s) => s.houses.some((h) => h.id === filterHouse))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((s) => s.name.toLowerCase().includes(q))
    }
    return result
  }, [spotters, filterHouse, search])

  // Collecties gegroepeerd per huis voor de doel-dropdown
  const collectionsByHouse = useMemo(() => {
    const groups = new Map()
    for (const c of collections) {
      const hn = c.auction_houses?.name ?? 'Zonder huis'
      if (!groups.has(hn)) groups.set(hn, [])
      groups.get(hn).push(c)
    }
    return [...groups].sort((a, b) => a[0].localeCompare(b[0], 'nl'))
  }, [collections])

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handlePatch(spotterId, patch) {
    setError(null)
    try {
      await updateSpotter(spotterId, patch)
      setSpotters((prev) => prev.map((s) => s.id === spotterId ? { ...s, ...patch } : s))
    } catch (e) { setError(e.message) }
  }

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setError(null)
    try {
      await createSpotter({ name })
      setNewName(''); setAdding(false)
      await load()
    } catch (e) { setError(e.message) }
  }

  async function handleAssign() {
    if (!targetCollectionId || selected.size === 0) return
    setError(null); setFeedback(null)
    try {
      const n = await assignSpottersToCollection(targetCollectionId, [...selected])
      const coll = collections.find((c) => c.id === targetCollectionId)
      const skipped = selected.size - n
      setFeedback(
        `${n} spotter${n === 1 ? '' : 's'} toegevoegd aan "${coll?.name ?? 'veiling'}"` +
        (skipped > 0 ? ` (${skipped} stond${skipped === 1 ? '' : 'en'} er al)` : '')
      )
      setSelected(new Set())
    } catch (e) { setError(e.message) }
  }

  return (
    <section>
      <Breadcrumbs trail={[
        { label: 'Veilinghuizen', to: '/' },
        { label: 'Spotterspool' },
      ]} />
      <h1>Spotterspool</h1>

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
          {houseOptions.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <button onClick={() => { setAdding((v) => !v); setNewName('') }} style={addBtnStyle}>
          + Nieuwe spotter
        </button>
      </div>

      {adding && (
        <div style={addFormStyle}>
          <input
            autoFocus type="text" placeholder="Naam van de spotter"
            value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setAdding(false) }}
            style={{ ...searchInputStyle, flex: 1 }}
          />
          <button onClick={handleCreate} disabled={!newName.trim()} style={addBtnStyle}>Aanmaken</button>
          <button onClick={() => setAdding(false)} style={cancelBtnStyle}>Annuleer</button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Spotters laden…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {spotters.length === 0 ? 'Nog geen spotters.' : 'Geen spotters voor deze filter.'}
        </p>
      ) : (
        <div style={gridStyle}>
          {filtered.map((s) => (
            <SpotterCard
              key={s.id}
              spotter={s}
              selected={selected.has(s.id)}
              onToggle={() => toggleSelect(s.id)}
              onPatch={(patch) => handlePatch(s.id, patch)}
            />
          ))}
        </div>
      )}

      {/* Selectie-actiebalk (sticky onderaan) */}
      {selected.size > 0 && (
        <div style={actionBarStyle}>
          <span style={{ fontWeight: 700 }}>{selected.size} geselecteerd</span>
          <span style={{ color: 'var(--text-secondary)' }}>→ toevoegen aan:</span>
          <select
            value={targetCollectionId}
            onChange={(e) => setTargetCollectionId(e.target.value)}
            style={filterStyle}
          >
            <option value="">— kies veiling —</option>
            {collectionsByHouse.map(([houseName, colls]) => (
              <optgroup key={houseName} label={houseName}>
                {colls.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.date ? ` (${new Date(c.date).getFullYear()})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!targetCollectionId}
            style={{ ...addBtnStyle, opacity: targetCollectionId ? 1 : 0.5 }}
          >
            Toevoegen
          </button>
          <button onClick={() => setSelected(new Set())} style={cancelBtnStyle}>Wis selectie</button>
        </div>
      )}

      {feedback && (
        <p style={{ color: 'var(--success)', marginTop: 'var(--space-3)', fontWeight: 600 }}>
          ✓ {feedback}
        </p>
      )}
    </section>
  )
}

function SpotterCard({ spotter, selected, onToggle, onPatch }) {
  const [name, setName] = useState(spotter.name)
  useEffect(() => { setName(spotter.name) }, [spotter.name])

  return (
    <div style={{ ...cardStyle, ...(selected ? cardSelectedStyle : {}) }}>
      <label style={checkboxLabelStyle}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          style={{ width: 18, height: 18, cursor: 'pointer' }}
        />
      </label>
      <PhotoUpload
        ownerId={spotter.id}
        pathPrefix="spotters"
        currentUrl={spotter.photo_url}
        onUploaded={(url) => onPatch({ photo_url: url })}
        onCleared={() => onPatch({ photo_url: null })}
        size={72}
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim()
          if (trimmed && trimmed !== spotter.name) onPatch({ name: trimmed })
          else if (!trimmed) setName(spotter.name)
        }}
        style={cardNameInputStyle}
        aria-label="Naam spotter"
      />
      <div style={houseBadgesStyle}>
        {spotter.houses.length === 0 ? (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75em', fontStyle: 'italic' }}>
            nog geen veiling
          </span>
        ) : (
          spotter.houses.map((h) => (
            <span key={h.id} style={houseBadgeStyle} title={h.name}>{h.name}</span>
          ))
        )}
      </div>
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
  background: 'var(--bg-input)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', fontFamily: 'inherit',
}
const filterStyle = {
  padding: '6px 8px',
  background: 'var(--bg-input)',
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
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 'var(--space-3)',
}
const cardStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  padding: 'var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  position: 'relative',
}
const cardSelectedStyle = {
  borderColor: 'var(--accent)',
  boxShadow: '0 0 0 1px var(--accent)',
}
const checkboxLabelStyle = {
  position: 'absolute', top: 8, left: 8,
  display: 'flex', alignItems: 'center',
}
const cardNameInputStyle = {
  width: '100%', textAlign: 'center',
  padding: '4px 6px', fontSize: '0.95em', fontWeight: 600,
  background: 'var(--bg-input)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', fontFamily: 'inherit',
}
const houseBadgesStyle = {
  display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center',
  minHeight: 18,
}
const houseBadgeStyle = {
  background: 'var(--bg-input)',
  color: 'var(--text-secondary)',
  fontSize: '0.7em', padding: '1px 6px',
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--border-default)',
  maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const actionBarStyle = {
  position: 'sticky', bottom: 0, zIndex: 5,
  display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
  marginTop: 'var(--space-4)', padding: 'var(--space-3)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-md)',
}
