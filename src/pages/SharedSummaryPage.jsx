import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import SummaryView from '../components/SummaryView'
import { fetchSharedSummary } from '../lib/shares'
import { computeSummary, formatAuctionDate } from '../lib/summaryStats'

// ============================================================
// SharedSummaryPage — de KALE, publieke deelweergave (route /gedeeld/:token).
//
// Bewust ZONDER: breadcrumb, AccountBar, links naar /lots of andere routes,
// correctie-knoppen. Een organisator met de link ziet uitsluitend het
// eindoverzicht van die ene veiling en kan nergens naartoe klikken.
//
// Data komt via fetchSharedSummary(token) → de SECURITY DEFINER-RPC, die enkel
// de collectie achter een geldig token teruggeeft. Geen token-match → een
// neutraal "link ongeldig"-scherm, ook zonder enige navigatie.
// ============================================================

export default function SharedSummaryPage() {
  const { token } = useParams()
  const [payload, setPayload] = useState(null)
  const [state, setState] = useState('loading') // loading | ok | invalid | error
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setState('loading')
      try {
        const data = await fetchSharedSummary(token)
        if (cancelled) return
        if (!data || !data.collection) {
          setState('invalid')
          return
        }
        setPayload(data)
        setState('ok')
      } catch (e) {
        if (cancelled) return
        setErrorMsg(e.message)
        setState('error')
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  return (
    <div style={pageStyle}>
      <main style={mainStyle}>
        {state === 'loading' && (
          <p style={{ color: 'var(--text-muted)' }}>Overzicht laden…</p>
        )}

        {state === 'invalid' && (
          <div style={cardStyle}>
            <h1 style={{ fontSize: '1.2rem', margin: '0 0 var(--space-3)' }}>Link niet (meer) geldig</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Deze deellink bestaat niet, is ingetrokken of is verlopen. Vraag de
              organisatie om een nieuwe link.
            </p>
          </div>
        )}

        {state === 'error' && (
          <div style={cardStyle}>
            <h1 style={{ fontSize: '1.2rem', margin: '0 0 var(--space-3)' }}>Overzicht tijdelijk niet beschikbaar</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Er ging iets mis bij het laden. Probeer het later opnieuw.
            </p>
            {errorMsg && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 'var(--space-3)' }}>{errorMsg}</p>}
          </div>
        )}

        {state === 'ok' && payload && (
          <SharedContent payload={payload} />
        )}
      </main>

      {state === 'ok' && (
        <footer style={footerStyle}>
          Gedeeld overzicht · Veiling&nbsp;Pro
        </footer>
      )}
    </div>
  )
}

function SharedContent({ payload }) {
  const { collection, lots, lot_types, days } = payload
  const computed = computeSummary(lots, lot_types)

  return (
    <section>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        {(collection.house_logo_url || collection.house_name) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            {collection.house_logo_url && (
              <img
                src={collection.house_logo_url}
                alt=""
                style={{ height: 28, width: 'auto', borderRadius: 'var(--radius-sm)' }}
              />
            )}
            {collection.house_name && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{collection.house_name}</span>
            )}
          </div>
        )}
        <h1 style={{ marginBottom: '0.25rem' }}>Overzicht — {collection.name}</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          {formatAuctionDate(collection)}
          {collection.location && ` · ${collection.location}`}
          {collection.status && ` · ${collection.status}`}
        </p>
      </header>

      <SummaryView
        computed={computed}
        lots={Array.isArray(lots) ? lots : []}
        days={Array.isArray(days) ? days : []}
        debriefText={collection.debrief_text}
        shared={true}
      />
    </section>
  )
}

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg-base, #0b0f0d)',
}
const mainStyle = {
  width: '100%',
  maxWidth: 900,
  margin: '0 auto',
  padding: 'var(--space-5)',
  flex: 1,
}
const cardStyle = {
  maxWidth: 480,
  margin: 'var(--space-6) auto',
  padding: 'var(--space-5)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  textAlign: 'center',
}
const footerStyle = {
  textAlign: 'center',
  color: 'var(--text-muted)',
  fontSize: '0.8rem',
  padding: 'var(--space-4)',
  borderTop: '1px solid var(--border-default)',
}
