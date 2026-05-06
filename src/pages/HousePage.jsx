import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Breadcrumbs from '../components/Breadcrumbs'
import AutoSaveUrl from '../components/AutoSaveUrl'

export default function HousePage() {
  const { houseId } = useParams()
  const [house, setHouse] = useState(null)
  const [collections, setCollections] = useState([])
  const [status, setStatus] = useState('Laden…')

  useEffect(() => {
    async function load() {
      const [houseRes, collectionsRes] = await Promise.all([
        supabase.from('auction_houses').select('*').eq('id', houseId).single(),
        supabase.from('collections').select('*').eq('house_id', houseId).order('date', { ascending: true }),
      ])

      if (houseRes.error) {
        setStatus(`Fout bij ophalen huis: ${houseRes.error.message}`)
        return
      }
      if (collectionsRes.error) {
        setStatus(`Fout bij ophalen veilingen: ${collectionsRes.error.message}`)
        return
      }

      setHouse(houseRes.data)
      setCollections(collectionsRes.data)
      setStatus(`${collectionsRes.data.length} veilingen`)
    }
    load()
  }, [houseId])

  return (
    <section>
      <Breadcrumbs trail={[
        { label: 'Veilinghuizen', to: '/' },
        { label: house?.name ?? 'Veilinghuis' },
      ]} />
      <h1 style={{ color: 'var(--text-primary)' }}>{house?.name ?? 'Veilinghuis'}</h1>
      <p style={{ color: 'var(--text-secondary)' }}>{status}</p>

      {house && (
        <div style={{ marginBottom: 'var(--space-4)', maxWidth: 480 }}>
          <AutoSaveUrl
            table="auction_houses"
            id={house.id}
            fieldName="logo_url"
            initialValue={house.logo_url}
            label="Logo-URL (voor 'Auction page'-link in cockpit)"
            placeholder="https://.../logo.png — wit-zwart, transparante achtergrond"
            onSaved={(value) => setHouse((prev) => ({ ...prev, logo_url: value }))}
          />
          {house.logo_url && (
            <div style={{ marginTop: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>Voorbeeld: </span>
              <img src={house.logo_url} alt="Logo" style={{ height: 24, marginLeft: 8, verticalAlign: 'middle', background: '#fff', padding: '2px 6px', borderRadius: 4 }} />
            </div>
          )}
        </div>
      )}

      {collections.length > 0 && (
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
      )}
    </section>
  )
}

function formatDate(d) {
  if (!d) return '(datum onbekend)'
  return new Date(d).toLocaleDateString('nl-BE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}
