import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function HousePage() {
  const { houseId } = useParams()
  const [house, setHouse] = useState(null)
  const [auctions, setAuctions] = useState([])
  const [status, setStatus] = useState('Laden…')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const [houseRes, auctionsRes] = await Promise.all([
        supabase.from('auction_houses').select('*').eq('id', houseId).single(),
        supabase.from('collections').select('*').eq('house_id', houseId).order('date', { ascending: true }),
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

  // Verwijder een veiling inclusief alle afhankelijke rijen, in de juiste
  // volgorde (kinderen vóór ouder) zodat FK-constraints niet blokkeren.
  async function deleteCollection(a) {
    setError(null)

    const { count } = await supabase
      .from('lots').select('id', { count: 'exact', head: true }).eq('collection_id', a.id)

    const msg =
      `Veiling "${a.name}" definitief verwijderen?\n\n` +
      `Dit verwijdert óók ${count ?? 0} lots en alle bijhorende ` +
      `biedstappen, lot-types en klant-koppelingen. Dit kan niet ongedaan ` +
      `gemaakt worden.`
    if (!window.confirm(msg)) return

    setBusyId(a.id)
    try {
      const { data: lots, error: lErr } = await supabase
        .from('lots').select('id').eq('collection_id', a.id)
      if (lErr) throw lErr
      const lotIds = (lots ?? []).map((l) => l.id)

      const step = async (label, p) => {
        const { error } = await p
        if (error) throw new Error(`${label}: ${error.message}`)
      }

      if (lotIds.length) {
        await step('klant-koppelingen',
          supabase.from('lot_interested_clients').delete().in('lot_id', lotIds))
      }
      await step('biedstappen',
        supabase.from('bid_step_rules').delete().eq('collection_id', a.id))
      await step('lot-types',
        supabase.from('collection_lot_types').delete().eq('collection_id', a.id))
      // active_lot_id wijst naar een lot → eerst loskoppelen.
      await step('actief lot loskoppelen',
        supabase.from('collections').update({ active_lot_id: null }).eq('id', a.id))
      await step('lots',
        supabase.from('lots').delete().eq('collection_id', a.id))
      await step('veiling',
        supabase.from('collections').delete().eq('id', a.id))

      setAuctions((prev) => prev.filter((x) => x.id !== a.id))
      setStatus((s) => {
        const n = auctions.length - 1
        return `${n} veiling${n === 1 ? '' : 'en'}`
      })
    } catch (e) {
      setError(`Verwijderen mislukt — ${e.message}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section>
      <p><Link to="/">← Veilinghuizen</Link></p>
      <h1>{house?.name ?? 'Veilinghuis'}</h1>
      <p style={{ color: '#666' }}>{status}</p>
      {error && (
        <p style={{ color: '#c0392b', fontSize: '0.9em' }}>❌ {error}</p>
      )}

      {auctions.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {auctions.map((a) => (
            <li
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.75rem 0', borderBottom: '1px solid #eee',
                opacity: busyId === a.id ? 0.5 : 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/auctions/${a.id}`} style={{ textDecoration: 'none', color: '#222' }}>
                  <strong>{a.name}</strong>
                </Link>
                <div style={{ color: '#666', fontSize: '0.9em', marginTop: '0.25rem' }}>
                  {formatDate(a.date)}
                  {a.location && ` — ${a.location}`}
                  {a.status && ` — ${a.status}`}
                </div>
              </div>
              <button
                onClick={() => deleteCollection(a)}
                disabled={busyId != null}
                title="Veiling verwijderen"
                style={{
                  flexShrink: 0,
                  padding: '0.35rem 0.7rem', fontSize: '0.85em',
                  border: '1px solid #d9b0b0', color: '#a23b3b',
                  background: '#fff', borderRadius: 4,
                  cursor: busyId != null ? 'wait' : 'pointer',
                }}
              >
                {busyId === a.id ? 'Verwijderen…' : '🗑 Verwijder'}
              </button>
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
