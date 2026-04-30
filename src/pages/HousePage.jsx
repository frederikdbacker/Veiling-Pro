import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function HousePage() {
  const { houseId } = useParams()
  const [house, setHouse] = useState(null)
  const [auctions, setAuctions] = useState([])
  const [status, setStatus] = useState('Laden…')

  useEffect(() => {
    async function load() {
      const [houseRes, auctionsRes] = await Promise.all([
        supabase.from('auction_houses').select('*').eq('id', houseId).single(),
        supabase.from('auctions').select('*').eq('house_id', houseId).order('date', { ascending: true }),
      ])

      if (houseRes.error) {
        setStatus(`Fout bij ophalen huis: ${houseRes.error.message}`)
        return
      }
      if (auctionsRes.error) {
        setStatus(`Fout bij ophalen veilingen: ${auctionsRes.error.message}`)
        return
      }

      setHouse(houseRes.data)
      setAuctions(auctionsRes.data)
      setStatus(`${auctionsRes.data.length} veilingen`)
    }
    load()
  }, [houseId])

  return (
    <section>
      <p><Link to="/">← Veilinghuizen</Link></p>
      <h1>{house?.name ?? 'Veilinghuis'}</h1>
      <p style={{ color: '#666' }}>{status}</p>

      {auctions.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {auctions.map((a) => (
            <li key={a.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #eee' }}>
              <Link to={`/auctions/${a.id}`} style={{ textDecoration: 'none', color: '#222' }}>
                <strong>{a.name}</strong>
              </Link>
              <div style={{ color: '#666', fontSize: '0.9em', marginTop: '0.25rem' }}>
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
