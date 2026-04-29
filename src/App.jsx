import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [status, setStatus] = useState('Verbinden met Supabase...')
  const [houses, setHouses] = useState([])

  useEffect(() => {
    async function check() {
      const { data, error } = await supabase
        .from('auction_houses')
        .select('*')
        .order('name')

      if (error) {
        setStatus(`Fout bij ophalen: ${error.message}`)
        return
      }
      setStatus(`Verbonden met Supabase — ${data.length} veilinghuizen gevonden`)
      setHouses(data)
    }
    check()
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: '2rem', maxWidth: 800 }}>
      <h1>Veiling Pro</h1>
      <p style={{ color: '#666' }}>{status}</p>
      {houses.length > 0 && (
        <ul>
          {houses.map((h) => (
            <li key={h.id}>
              <strong>{h.name}</strong>
              {h.country && ` — ${h.country}`}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
