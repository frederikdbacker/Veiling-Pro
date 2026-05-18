import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

// Verden YoungSTARS 2026 — preset zodat dit met één klik klaarstaat.
const VERDEN_PRESET = {
  url: 'https://verdener-auktion-online.com/de/auctions/details/verdener-auktion-onlive-youngstars-2026-135',
  name: 'Verden Auction YoungSTARS OnLive',
  house: 'Verden',
  location: 'Verden',
  date: '2026-05-30',
  status: 'planned',
}

const EMPTY = { url: '', name: '', house: '', location: '', date: '', status: 'planned' }

export default function CollectionsPage() {
  const [sp] = useSearchParams()
  const [form, setForm] = useState({
    url: sp.get('url') || '',
    name: sp.get('name') || '',
    house: sp.get('house') || '',
    location: sp.get('location') || '',
    date: sp.get('date') || '',
    status: sp.get('status') || 'planned',
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [result, setResult] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.url.trim()) return
    setBusy(true)
    setMsg('Collectie ophalen en importeren… dit kan ~½–1 min duren (alle paarden worden verrijkt).')
    setResult(null)
    try {
      const res = await fetch('/api/import-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setResult(data)
      setMsg(null)
    } catch (err) {
      setMsg(`Fout: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <p><Link to="/">← Veilinghuizen</Link></p>
      <h1>Collectie importeren via URL</h1>
      <p style={{ color: '#666' }}>
        Plak de URL van een HORSE24-veiling (bv. verdener-auktion-online.com).
        Het systeem haalt de hele collectie op — naam, afstamming, geslacht,
        foto&apos;s, catalogustekst en video per paard — en zet die in de app.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setForm(VERDEN_PRESET)}
          style={btnSecondary}
        >
          ⚡ Verden YoungSTARS 2026 voorinvullen
        </button>
        <button
          type="button"
          onClick={() => { setForm(EMPTY); setResult(null); setMsg(null) }}
          style={{ ...btnSecondary, marginLeft: '0.5rem' }}
        >
          Leegmaken
        </button>
      </div>

      <form onSubmit={submit} style={{ display: 'grid', gap: '0.75rem', maxWidth: 560 }}>
        <Field label="Veiling-URL *">
          <input
            type="url" required value={form.url} onChange={set('url')}
            placeholder="https://verdener-auktion-online.com/de/auctions/details/…"
            style={input}
          />
        </Field>
        <Field label="Veilingnaam (in app)" hint="leeg = automatisch uit de bron">
          <input value={form.name} onChange={set('name')} placeholder="Verden Auction YoungSTARS OnLive" style={input} />
        </Field>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Field label="Veilinghuis" hint="leeg = 1e woord">
            <input value={form.house} onChange={set('house')} placeholder="Verden" style={input} />
          </Field>
          <Field label="Locatie">
            <input value={form.location} onChange={set('location')} placeholder="Verden" style={input} />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Field label="Datum" hint="leeg = uit de bron">
            <input type="date" value={form.date} onChange={set('date')} style={input} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set('status')} style={input}>
              <option value="planned">planned</option>
              <option value="running">running</option>
              <option value="ended">ended</option>
            </select>
          </Field>
        </div>

        <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Bezig…' : 'Collectie ophalen'}
        </button>
      </form>

      {msg && (
        <p style={{ marginTop: '1rem', color: msg.startsWith('Fout') ? '#c0392b' : '#666' }}>
          {msg}
        </p>
      )}

      {result && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f3f8f3', borderRadius: 6 }}>
          <strong>✅ Geïmporteerd</strong>
          <div style={{ marginTop: '0.5rem', fontSize: '0.95em' }}>
            {result.house.name} — <strong>{result.collection.name}</strong>
            {result.collection_created ? ' (nieuw aangemaakt)' : ' (bestond al)'}<br />
            {result.collection.date || '—'} · {result.collection.location || '—'} · {result.collection.status}<br />
            {result.inserted} nieuwe lots ingevoegd · {result.skipped} overgeslagen (al aanwezig) · {result.total} in collectie
          </div>
          <p style={{ marginTop: '0.75rem' }}>
            <Link to={`/auctions/${result.collection.id}`} style={btnPrimary}>
              → Open de veiling
            </Link>
          </p>
        </div>
      )}
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block', flex: 1 }}>
      <span style={{ display: 'block', fontSize: '0.85em', color: '#444', marginBottom: '0.2rem' }}>
        {label}{hint && <span style={{ color: '#999' }}> — {hint}</span>}
      </span>
      {children}
    </label>
  )
}

const input = {
  width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #ccc',
  borderRadius: 4, fontSize: '0.95em', boxSizing: 'border-box',
}
const btnPrimary = {
  display: 'inline-block', padding: '0.5rem 0.9rem', background: '#222',
  color: '#fff', border: 'none', borderRadius: 4, textDecoration: 'none',
  fontSize: '0.95em', cursor: 'pointer',
}
const btnSecondary = {
  padding: '0.4rem 0.7rem', background: '#fff', color: '#222',
  border: '1px solid #bbb', borderRadius: 4, fontSize: '0.9em', cursor: 'pointer',
}
