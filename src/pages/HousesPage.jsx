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
      <h1>Veilinghuizen</h1>
      <p style={{ color: '#666' }}>{status}</p>
      <ul>
        {houses.map((h) => (
          <li key={h.id}>
            <Link to={`/houses/${h.id}`}>
              <strong>{h.name}</strong>
            </Link>
            {h.country && ` — ${h.country}`}
          </li>
        ))}
      </ul>
    </section>
  )
}
