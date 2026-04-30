import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BidStepRulesPreview from '../components/BidStepRulesPreview'

/**
 * Live Cockpit — wat Frederik gebruikt tijdens de veiling.
 * Stap 1 (dit bestand): skelet met read-only info per actief lot.
 * Stap 2+: knoppen (in de piste / start / hamer), live timer, bid-flow,
 *          editable notes, sessie-statistieken.
 */
export default function CockpitPage() {
  const { auctionId } = useParams()
  const [auction, setAuction] = useState(null)
  const [allLots, setAllLots] = useState([])
  const [activeLot, setActiveLot] = useState(null)
  const [interestedClients, setInterestedClients] = useState([])
  const [error, setError] = useState(null)

  // 1. Veiling + alle lots laden bij wijzigen van auctionId
  useEffect(() => {
    setAuction(null); setActiveLot(null); setAllLots([]); setError(null)
    let cancelled = false
    async function load() {
      const [auctionRes, lotsRes] = await Promise.all([
        supabase
          .from('auctions')
          .select('*, auction_houses(id, name)')
          .eq('id', auctionId)
          .single(),
        supabase
          .from('lots')
          .select('id, number, name')
          .eq('auction_id', auctionId)
          .order('number', { nullsFirst: false })
          .order('name'),
      ])
      if (cancelled) return
      if (auctionRes.error) { setError(auctionRes.error.message); return }
      if (lotsRes.error)    { setError(lotsRes.error.message); return }
      setAuction(auctionRes.data)
      setAllLots(lotsRes.data ?? [])
    }
    load()
    return () => { cancelled = true }
  }, [auctionId])

  // 2. Actief lot + zijn geïnteresseerde klanten laden bij wijzigen van active_lot_id
  useEffect(() => {
    setActiveLot(null); setInterestedClients([])
    if (!auction?.active_lot_id) return
    let cancelled = false
    async function loadLot() {
      const [lotRes, clientsRes] = await Promise.all([
        supabase
          .from('lots')
          .select('*, lot_types(name_nl)')
          .eq('id', auction.active_lot_id)
          .single(),
        supabase
          .from('lot_interested_clients')
          .select('notes, clients(id, name, country, notes)')
          .eq('lot_id', auction.active_lot_id),
      ])
      if (cancelled) return
      if (!lotRes.error)    setActiveLot(lotRes.data)
      if (!clientsRes.error) setInterestedClients(clientsRes.data ?? [])
    }
    loadLot()
    return () => { cancelled = true }
  }, [auction?.active_lot_id])

  async function setActiveLotById(lotId) {
    const value = lotId || null
    const { error } = await supabase
      .from('auctions')
      .update({ active_lot_id: value })
      .eq('id', auctionId)
    if (!error) {
      setAuction((prev) => ({ ...prev, active_lot_id: value }))
    }
  }

  if (error) {
    return (
      <main style={pageStyle}>
        <p style={{ color: '#c33' }}>❌ {error}</p>
        <p><Link to="/">← Terug naar start</Link></p>
      </main>
    )
  }

  if (!auction) {
    return <main style={pageStyle}><p style={{ color: '#666' }}>Cockpit laden…</p></main>
  }

  const houseId = auction.auction_houses?.id
  const houseName = auction.auction_houses?.name

  return (
    <main style={pageStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ fontSize: '0.85em', color: '#888' }}>
          <Link to="/" style={crumbStyle}>Veilinghuizen</Link>
          {houseId && <>{' › '}<Link to={`/houses/${houseId}`} style={crumbStyle}>{houseName}</Link></>}
          {' › '}<Link to={`/auctions/${auctionId}`} style={crumbStyle}>{auction.name}</Link>
          {' › '}Cockpit
        </div>
        <h1 style={{ margin: '0.25rem 0', fontSize: '1.4em' }}>{auction.name}</h1>
        <div style={{ color: '#666', fontSize: '0.9em' }}>
          {formatAuctionDate(auction)}
          {auction.location && ` · ${auction.location}`}
        </div>
      </header>

      {/* Lot picker */}
      <section style={pickerStyle}>
        <label style={{ fontWeight: 600, marginRight: 8 }}>Actief lot:</label>
        <select
          value={auction.active_lot_id ?? ''}
          onChange={(e) => setActiveLotById(e.target.value)}
          style={selectStyle}
        >
          <option value="">— geen lot geselecteerd —</option>
          {allLots.map((l) => (
            <option key={l.id} value={l.id}>
              #{l.number ?? '—'} {l.name}
            </option>
          ))}
        </select>
      </section>

      {/* Active lot panel */}
      {!auction.active_lot_id && (
        <p style={{ color: '#888', fontStyle: 'italic' }}>
          Kies hierboven welk lot in de piste is om te beginnen.
        </p>
      )}
      {auction.active_lot_id && !activeLot && (
        <p style={{ color: '#888' }}>Lot laden…</p>
      )}
      {activeLot && (
        <ActiveLotPanel
          lot={activeLot}
          auctionId={auctionId}
          interestedClients={interestedClients}
        />
      )}
    </main>
  )
}

function ActiveLotPanel({ lot, auctionId, interestedClients }) {
  const photos = Array.isArray(lot.photos) ? lot.photos : []
  const [activePhoto, setActivePhoto] = useState(0)

  // Reset gallery wanneer een ander lot geselecteerd wordt
  useEffect(() => { setActivePhoto(0) }, [lot.id])

  const meta = [
    lot.discipline,
    formatYearAge(lot.year),
    lot.gender,
    lot.studbook,
    lot.size,
  ].filter(Boolean).join(' · ')

  return (
    <section style={panelStyle}>
      {/* Top row: photo gallery + lot identity side by side */}
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
        {photos.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <img
              src={photos[activePhoto]}
              alt={lot.name}
              style={{
                width: 240, height: 240, objectFit: 'cover',
                borderRadius: 6, background: '#eee', display: 'block',
              }}
            />
            {photos.length > 1 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', maxWidth: 240 }}>
                {photos.map((p, i) => (
                  <button
                    key={p}
                    onClick={() => setActivePhoto(i)}
                    title={`Foto ${i + 1}`}
                    style={{
                      padding: 0,
                      border: i === activePhoto ? '2px solid #222' : '2px solid transparent',
                      background: 'transparent', borderRadius: 3, cursor: 'pointer',
                    }}
                  >
                    <img src={p} alt="" width={36} height={36} loading="lazy"
                      style={{ objectFit: 'cover', borderRadius: 2, display: 'block' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ color: '#999', fontSize: '0.9em' }}>
            Lot #{lot.number ?? '—'}
            {lot.lot_types?.name_nl && ` · ${lot.lot_types.name_nl}`}
          </div>
          <h2 style={{ margin: '0.15rem 0 0.4rem 0', fontSize: '1.6em' }}>{lot.name}</h2>
          <div style={{ color: '#555' }}>{meta}</div>
          {(lot.sire || lot.dam) && (
            <div style={{ color: '#666', fontStyle: 'italic', marginTop: 4 }}>
              {lot.sire ?? '?'} × {lot.dam ?? '?'}
            </div>
          )}
          <div style={{ marginTop: 10, color: '#666', fontSize: '0.9em' }}>
            Start €{formatNum(lot.start_price)}
            {lot.reserve_price != null && ` · Reserve €${formatNum(lot.reserve_price)}`}
          </div>
        </div>
      </div>

      {/* Catalogustekst — wat Frederik voorleest */}
      {lot.catalog_text && (
        <div style={blockStyle}>
          <h3 style={blockHeadingStyle}>Catalogustekst</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>
            {lot.catalog_text}
          </p>
        </div>
      )}

      {/* EquiRatings — sportstatistiek */}
      {lot.equiratings_text && (
        <div style={blockStyle}>
          <h3 style={blockHeadingStyle}>EquiRatings</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5, color: '#555' }}>
            {lot.equiratings_text}
          </p>
        </div>
      )}

      {/* Notes (read-only voor nu) */}
      <div style={blockStyle}>
        <h3 style={blockHeadingStyle}>Mijn voorbereiding</h3>
        <NoteRow label="Catalogus"    value={lot.notes_catalog} />
        <NoteRow label="Video"        value={lot.notes_video} />
        <NoteRow label="Organisatie"  value={lot.notes_org} />
      </div>

      {/* Klanten (placeholder zolang 0b nog niet gebouwd) */}
      <div style={blockStyle}>
        <h3 style={blockHeadingStyle}>Geïnteresseerde klanten</h3>
        {interestedClients.length === 0 ? (
          <p style={{ color: '#999', fontStyle: 'italic', fontSize: '0.9em', margin: 0 }}>
            Nog geen klanten gekoppeld. Komt in een latere stap (UI op LotPage).
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {interestedClients.map((row) => (
              <li key={row.clients.id} style={{ padding: '2px 0' }}>
                <strong>{row.clients.name}</strong>
                {row.clients.country && ` (${row.clients.country})`}
                {row.notes && <span style={{ color: '#888' }}> — {row.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Externe links (read-only — bewerken op LotPage) */}
      {(lot.url_hippomundo || lot.url_horsetelex || lot.url_extra) && (
        <div style={blockStyle}>
          <h3 style={blockHeadingStyle}>Externe links</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lot.url_hippomundo && <ExternalLink href={lot.url_hippomundo} label="Hippomundo" />}
            {lot.url_horsetelex && <ExternalLink href={lot.url_horsetelex} label="Horsetelex" />}
            {lot.url_extra      && <ExternalLink href={lot.url_extra}      label="Extra" />}
          </div>
        </div>
      )}

      {/* Bid-staffel preview */}
      <div style={blockStyle}>
        <BidStepRulesPreview auctionId={auctionId} lotTypeId={lot.lot_type_id} />
      </div>

      {/* Knoppen-placeholder voor stap 2+ */}
      <div style={{ ...blockStyle, color: '#bbb', fontStyle: 'italic' }}>
        Knoppen "In de piste / Start bieden / Hamer", live timer, bid-flow en
        sessie-statistieken volgen in stap 2 t/m 6.
      </div>
    </section>
  )
}

function NoteRow({ label, value }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontWeight: 600, color: '#555', marginRight: 6 }}>{label}:</span>
      {value
        ? <span>{value}</span>
        : <span style={{ color: '#bbb', fontStyle: 'italic' }}>—</span>}
    </div>
  )
}

function ExternalLink({ href, label }) {
  return (
    <a
      href={href}
      target="_blank" rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '0.3rem 0.65rem',
        background: '#f0f0f0', color: '#222',
        textDecoration: 'none', borderRadius: 4,
        fontSize: '0.9em',
      }}
    >
      🔗 {label}
    </a>
  )
}

function formatAuctionDate(auction) {
  if (!auction.date) return '(datum onbekend)'
  const d = new Date(auction.date)
  const datePart = d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })
  if (!auction.time_auction_start) return datePart
  const t = new Date(auction.time_auction_start)
  const timePart = t.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} · ${timePart}`
}

function formatNum(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 0 })
}

function formatYearAge(year) {
  if (!year) return null
  const age = new Date().getFullYear() - year
  return `${year}/${age} jaar`
}

const pageStyle = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  padding: '1rem 1.5rem',
  maxWidth: 1100,
  margin: '0 auto',
}
const headerStyle = {
  borderBottom: '1px solid #ddd',
  paddingBottom: '0.5rem',
  marginBottom: '1rem',
}
const crumbStyle = { color: '#888', textDecoration: 'none' }
const pickerStyle = {
  background: '#fafafa', border: '1px solid #eee',
  borderRadius: 6, padding: '0.6rem 0.85rem', marginBottom: '1rem',
}
const selectStyle = {
  padding: '0.4rem 0.5rem', fontSize: '1em',
  border: '1px solid #ccc', borderRadius: 4,
  minWidth: '20em',
}
const panelStyle = {
  border: '1px solid #ddd', borderRadius: 8,
  padding: '1rem', background: '#fff',
}
const blockStyle = {
  marginTop: '1rem', paddingTop: '1rem',
  borderTop: '1px solid #eee',
}
const blockHeadingStyle = {
  fontSize: '1em', margin: '0 0 0.5rem 0', color: '#555',
}
