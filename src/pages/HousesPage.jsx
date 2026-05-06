import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function HousesPage() {
  const [status, setStatus] = useState('Laden…')
  const [houses, setHouses] = useState([])

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('auction_houses')
        .select('*')
        .order('name')

      if (error) {
        setStatus(`Fout bij ophalen: ${error.message}`)
        return
      }
      setStatus(`${data.length} veilinghuizen gevonden`)
      setHouses(data)
    }
    load()
  }, [])

  return (
    <section>
      <h1 style={{ color: 'var(--text-primary)' }}>Veilinghuizen</h1>
      <p style={{ color: 'var(--text-secondary)' }}>{status}</p>
      <p style={{ marginBottom: 'var(--space-3)' }}>
        <Link to="/clients" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          👥 Alle klanten →
        </Link>
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {houses.map((h) => (
          <li key={h.id} style={{
            padding: 'var(--space-3) 0',
            borderBottom: '1px solid var(--border-default)',
          }}>
            <Link
              to={`/houses/${h.id}`}
              style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}
            >
              {h.name}
            </Link>
            {h.country && (
              <span style={{ color: 'var(--text-muted)' }}> — {h.country}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
