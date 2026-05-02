import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BidStepRulesPreview from '../components/BidStepRulesPreview'
import CockpitStatusBar from '../components/CockpitStatusBar'
import BuyerAutocomplete from '../components/BuyerAutocomplete'
import {
  getInterestedClientsForLot,
  getPurchasesByClientsInAuction,
  createClient,
} from '../lib/clients'

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
  const [purchasesByClient, setPurchasesByClient] = useState(new Map())
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
          .select('id, number, name, sold, sale_price, time_hammer, duration_seconds, time_entered_ring, time_bidding_start')
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

  // 2. Actief lot + zijn geïnteresseerde klanten + hun aankopen laden
  useEffect(() => {
    setActiveLot(null)
    setInterestedClients([])
    setPurchasesByClient(new Map())
    if (!auction?.active_lot_id) return
    let cancelled = false
    async function loadLot() {
      const [lotRes, clients] = await Promise.all([
        supabase
          .from('lots')
          .select('*, lot_types(name_nl)')
          .eq('id', auction.active_lot_id)
          .single(),
        getInterestedClientsForLot(auction.active_lot_id, auctionId),
      ])
      if (cancelled) return
      if (!lotRes.error) setActiveLot(lotRes.data)
      setInterestedClients(clients)
      if (clients.length > 0) {
        const map = await getPurchasesByClientsInAuction(
          auctionId,
          clients.map((c) => c.client_id),
        )
        if (!cancelled) setPurchasesByClient(map)
      }
    }
    loadLot()
    return () => { cancelled = true }
  }, [auction?.active_lot_id, auctionId])

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

      {/* Statusbalk: voortgang, omzet, gem. duur en verwacht einduur */}
      <CockpitStatusBar lots={allLots} />

      {/* Overzicht-knop, verschijnt zodra alle lots gehamerd zijn */}
      {allLots.length > 0 && allLots.every((l) => l.time_hammer != null) && (
        <div style={{ marginBottom: '1rem' }}>
          <Link
            to={`/auctions/${auctionId}/summary`}
            style={{
              display: 'inline-block',
              padding: '0.5rem 0.85rem',
              background: '#5A8A5A', color: '#fff',
              borderRadius: 4, textDecoration: 'none',
              fontWeight: 600, fontSize: '0.95em',
            }}
          >
            📊 Overzicht einde veiling →
          </Link>
        </div>
      )}

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
          houseId={houseId}
          interestedClients={interestedClients}
          purchasesByClient={purchasesByClient}
          allLots={allLots}
          onLotUpdated={async (updated) => {
            setActiveLot((prev) => ({ ...prev, ...updated }))
            setAllLots((prev) => prev.map((l) => l.id === updated.id ? { ...l, ...updated } : l))
            // Na elke lot-update: herlaad purchases voor de huidige
            // geïnteresseerden, zodat de "✓ al gekocht"-indicator klopt
            // zodra dit lot of een ander lot een koper kreeg.
            if (interestedClients.length > 0) {
              const map = await getPurchasesByClientsInAuction(
                auctionId,
                interestedClients.map((c) => c.client_id),
              )
              setPurchasesByClient(map)
            }
          }}
          onActiveLotChange={setActiveLotById}
        />
      )}
    </main>
  )
}

function ActiveLotPanel({ lot, auctionId, houseId, interestedClients, purchasesByClient, allLots, onLotUpdated, onActiveLotChange }) {
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

      {/* Live cockpit-controls */}
      <CockpitControls
        lot={lot}
        allLots={allLots}
        houseId={houseId}
        interestedClients={interestedClients}
        onLotUpdated={onLotUpdated}
        onActiveLotChange={onActiveLotChange}
      />

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

      {/* Geïnteresseerde klanten — read-only weergave; bewerken op LotPage */}
      <div style={blockStyle}>
        <h3 style={blockHeadingStyle}>Geïnteresseerde klanten</h3>
        {interestedClients.length === 0 ? (
          <p style={{ color: '#999', fontStyle: 'italic', fontSize: '0.9em', margin: 0 }}>
            Nog geen klanten gekoppeld. Voeg ze toe op de lot-detailpagina.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {interestedClients.map((entry) => {
              const purchases = purchasesByClient?.get(entry.client_id)
              const meta = []
              if (entry.table_number) meta.push(`tafel ${entry.table_number}`)
              if (entry.direction)    meta.push(entry.direction)
              return (
                <li key={entry.client_id} style={{ padding: '4px 0' }}>
                  <strong>{entry.name}</strong>
                  {meta.length > 0 && (
                    <span style={{ color: '#555' }}> — {meta.join(' · ')}</span>
                  )}
                  {entry.seating_notes && (
                    <span style={{ color: '#888', fontStyle: 'italic' }}> — "{entry.seating_notes}"</span>
                  )}
                  {entry.lot_notes && (
                    <div style={{ color: '#666', fontSize: '0.85em', marginLeft: '0.5em' }}>
                      ↪ specifiek voor dit paard: {entry.lot_notes}
                    </div>
                  )}
                  {purchases && purchases.length > 0 && (
                    <div style={{ color: '#5A8A5A', fontSize: '0.85em', fontWeight: 600, marginLeft: '0.5em', marginTop: 2 }}>
                      ✓ al gekocht in deze veiling:{' '}
                      {purchases.map((p) => `#${p.number ?? '—'} ${p.name}`).join(', ')}
                    </div>
                  )}
                </li>
              )
            })}
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

function CockpitControls({ lot, allLots, houseId, interestedClients, onLotUpdated, onActiveLotChange }) {
  const [now, setNow] = useState(() => new Date())
  const [busy, setBusy] = useState(null)  // 'in-ring' | 'start' | 'hamer-form' | null
  const [hamerFormOpen, setHamerFormOpen] = useState(false)
  const [outcome, setOutcome] = useState('zaal')  // 'zaal' | 'online' | 'unsold'
  const [priceInput, setPriceInput] = useState('')
  const [buyer, setBuyer] = useState({ client_id: null, name: '' })

  // Tick elke seconde voor de live timer
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Reset alle hamer-form-state wanneer een ander lot geselecteerd wordt
  useEffect(() => {
    setHamerFormOpen(false)
    setOutcome('zaal')
    setPriceInput('')
    setBuyer({ client_id: null, name: '' })
  }, [lot.id])

  const inRing   = lot.time_entered_ring  != null
  const bidding  = lot.time_bidding_start != null
  const hammered = lot.time_hammer        != null

  const inRingState = !inRing  ? 'active' : 'done'
  const startState  = !inRing  ? 'pending' : (!bidding  ? 'active' : 'done')
  const hammerState = !bidding ? 'pending' : (!hammered ? 'active' : 'done')

  async function patchTimestamp(field, busyKey) {
    setBusy(busyKey)
    const { data, error } = await supabase
      .from('lots')
      .update({ [field]: new Date().toISOString() })
      .eq('id', lot.id)
      .select()
      .single()
    setBusy(null)
    if (!error && data) onLotUpdated(data)
  }

  function calcDurationSeconds() {
    if (!lot.time_entered_ring) return null
    const enteredAt = new Date(lot.time_entered_ring).getTime()
    return Math.floor((Date.now() - enteredAt) / 1000)
  }

  function openHamerForm() {
    setHamerFormOpen(true)
    setOutcome('zaal')
    setPriceInput('')
    setBuyer({ client_id: null, name: '' })
  }

  /**
   * Bepaalt de uiteindelijke koper:
   *   - bestaande klant geselecteerd via autocomplete → gebruik die id
   *   - nieuwe naam getypt → maak een client aan voor het huis
   *   - leeg gelaten → null (koper onbekend / niet vastgelegd)
   */
  async function resolveBuyer() {
    if (buyer.client_id) {
      return { id: buyer.client_id, name: (buyer.name || '').trim() || null }
    }
    const trimmed = (buyer.name || '').trim()
    if (!trimmed) return { id: null, name: null }
    if (!houseId) {
      throw new Error('Veilinghuis-id ontbreekt — kan koper niet aanmaken.')
    }
    const created = await createClient(houseId, trimmed)
    return { id: created.id, name: created.name }
  }

  async function commitHamerForm() {
    const trimmed = priceInput.trim()
    if (outcome === 'zaal' || outcome === 'online') {
      if (trimmed === '') {
        alert('Vul de verkoopprijs in.')
        return
      }
      const price = Number(trimmed)
      if (Number.isNaN(price) || price < 0) {
        alert('Verkoopprijs is geen geldig getal.')
        return
      }
      setBusy('hamer-form')
      let resolvedBuyer
      try {
        resolvedBuyer = await resolveBuyer()
      } catch (e) {
        setBusy(null)
        alert(`Fout bij koper: ${e.message}`)
        return
      }
      const { data, error } = await supabase
        .from('lots')
        .update({
          time_hammer: new Date().toISOString(),
          sale_price: price,
          sold: true,
          sale_channel: outcome,
          duration_seconds: calcDurationSeconds(),
          buyer_client_id: resolvedBuyer.id,
          buyer: resolvedBuyer.name,
        })
        .eq('id', lot.id)
        .select()
        .single()
      setBusy(null)
      if (error) { alert(`Fout: ${error.message}`); return }
      if (data) {
        onLotUpdated(data)
        setHamerFormOpen(false)
      }
    } else {
      // outcome === 'unsold'
      let highestBid = null
      if (trimmed !== '') {
        const n = Number(trimmed)
        if (Number.isNaN(n) || n < 0) {
          alert('Hoogste bod is geen geldig getal.')
          return
        }
        highestBid = n
      }
      setBusy('hamer-form')
      const { data, error } = await supabase
        .from('lots')
        .update({
          time_hammer: new Date().toISOString(),
          sale_price: highestBid,
          sold: false,
          sale_channel: null,
          duration_seconds: calcDurationSeconds(),
          buyer_client_id: null,
          buyer: null,
        })
        .eq('id', lot.id)
        .select()
        .single()
      setBusy(null)
      if (error) { alert(`Fout: ${error.message}`); return }
      if (data) {
        onLotUpdated(data)
        setHamerFormOpen(false)
      }
    }
  }

  // Volgend lot — index in de gesorteerde lijst (zelfde sortering als picker)
  const idx = allLots.findIndex((l) => l.id === lot.id)
  const nextLot = idx >= 0 && idx < allLots.length - 1 ? allLots[idx + 1] : null

  return (
    <div style={controlsBlockStyle}>
      {/* Live timers — alleen tijdens de flow */}
      {!hammered && (
        <div style={timersStyle}>
          {inRing && (
            <span>⏱ <strong>{formatElapsed(now - new Date(lot.time_entered_ring))}</strong> in de piste</span>
          )}
          {bidding && (
            <span style={{ marginLeft: '1.25rem' }}>
              ⏱ <strong>{formatElapsed(now - new Date(lot.time_bidding_start))}</strong> bieden actief
            </span>
          )}
          {!inRing && (
            <span style={{ color: '#aaa', fontStyle: 'italic' }}>
              Klik "In de piste" wanneer het paard binnenkomt.
            </span>
          )}
        </div>
      )}

      {/* Resultaat na hamer */}
      {hammered && (
        <div style={{ ...timersStyle, color: lot.sold ? '#5A8A5A' : '#a06010' }}>
          {lot.sold
            ? `✓ Verkocht ${lot.sale_channel === 'zaal' ? 'in zaal' : lot.sale_channel === 'online' ? 'online' : ''}`.trim()
            : '⊘ Niet verkocht'}
          {lot.sale_price != null && ` — €${formatNum(lot.sale_price)}`}
          {' om '}{new Date(lot.time_hammer).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
          {lot.duration_seconds != null && ` (duur ${formatElapsed(lot.duration_seconds * 1000)})`}
        </div>
      )}

      {/* Drie-knop-flow */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <FlowButton
          label="IN DE PISTE"
          state={inRingState}
          busy={busy === 'in-ring'}
          onClick={() => patchTimestamp('time_entered_ring', 'in-ring')}
        />
        <FlowButton
          label="START BIEDEN"
          state={startState}
          busy={busy === 'start'}
          onClick={() => patchTimestamp('time_bidding_start', 'start')}
        />
        <FlowButton
          label="HAMER"
          state={hammerState}
          busy={busy === 'hamer-form'}
          onClick={openHamerForm}
        />
      </div>

      {/* Hamer-form — opent NA klik op HAMER */}
      {hamerFormOpen && bidding && !hammered && (
        <div style={priceFormStyle}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Hoe is dit lot afgerond?</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            <label style={radioLabelStyle}>
              <input type="radio" name="outcome" value="zaal"
                checked={outcome === 'zaal'} onChange={() => setOutcome('zaal')} />
              <span>Verkocht <strong>in zaal</strong></span>
            </label>
            <label style={radioLabelStyle}>
              <input type="radio" name="outcome" value="online"
                checked={outcome === 'online'} onChange={() => setOutcome('online')} />
              <span>Verkocht <strong>online</strong></span>
            </label>
            <label style={radioLabelStyle}>
              <input type="radio" name="outcome" value="unsold"
                checked={outcome === 'unsold'} onChange={() => setOutcome('unsold')} />
              <span><strong>Niet verkocht</strong></span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>
              {outcome === 'unsold' ? 'Hoogste bod (optioneel):' : 'Verkoopprijs:'}
            </span>
            <span style={{ color: '#666' }}>€</span>
            <input
              type="text"
              inputMode="numeric"
              value={priceInput === '' ? '' : Number(priceInput).toLocaleString('nl-BE', { maximumFractionDigits: 0 })}
              onChange={(e) => setPriceInput(e.target.value.replace(/[^\d]/g, ''))}
              placeholder={outcome === 'unsold' ? 'optioneel' : 'bv. 15.000'}
              style={priceInputStyle}
              autoFocus
            />
          </div>

          {(outcome === 'zaal' || outcome === 'online') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, minWidth: '5em' }}>Koper:</span>
              <BuyerAutocomplete
                houseId={houseId}
                priorityClients={interestedClients}
                value={buyer}
                onChange={setBuyer}
                disabled={busy === 'hamer-form'}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => setHamerFormOpen(false)}
              disabled={busy === 'hamer-form'}
              style={cancelBtnStyle}
            >
              Annuleer
            </button>
            <button
              onClick={commitHamerForm}
              disabled={busy === 'hamer-form'}
              style={confirmBtnStyle}
            >
              {busy === 'hamer-form' ? '…' : 'Bevestig hamer'}
            </button>
          </div>
        </div>
      )}

      {/* Volgend lot */}
      <div style={{ marginTop: 10 }}>
        <button
          onClick={() => nextLot && onActiveLotChange(nextLot.id)}
          disabled={!nextLot}
          style={{
            padding: '0.5rem 0.85rem', fontSize: '0.95em',
            border: '1px solid #ccc', borderRadius: 4,
            background: nextLot ? '#fff' : '#f5f5f5',
            color: nextLot ? '#222' : '#aaa',
            cursor: nextLot ? 'pointer' : 'not-allowed',
          }}
        >
          {nextLot
            ? `Volgend lot → #${nextLot.number ?? '—'} ${nextLot.name}`
            : 'Einde van de lijst'}
        </button>
      </div>
    </div>
  )
}

function FlowButton({ label, state, busy, onClick }) {
  const stateStyles = {
    pending: { background: '#eee', color: '#aaa', cursor: 'not-allowed', opacity: 0.55 },
    active:  { background: '#222', color: '#fff', cursor: 'pointer' },
    done:    { background: '#5A8A5A', color: '#fff', cursor: 'default', opacity: 0.85 },
  }[state]

  return (
    <button
      onClick={state === 'active' && !busy ? onClick : undefined}
      disabled={state !== 'active' || busy}
      style={{
        flex: 1, padding: '0.85rem 1rem',
        fontSize: '1.05em', fontWeight: 600,
        border: 'none', borderRadius: 6,
        ...stateStyles,
      }}
    >
      {state === 'done' ? '✓ ' : ''}{busy ? '…' : label}
    </button>
  )
}

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
const controlsBlockStyle = {
  marginTop: '1.25rem', padding: '0.85rem 1rem',
  background: '#f8f8f8', border: '1px solid #ddd',
  borderRadius: 6,
}
const timersStyle = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '1.1em', color: '#333',
}
const priceFormStyle = {
  marginTop: 10,
  padding: '0.6rem 0.85rem',
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 4,
}
const priceInputStyle = {
  padding: '0.4rem 0.5rem',
  fontSize: '1em',
  border: '1px solid #ccc',
  borderRadius: 4,
  width: '8em',
  fontFamily: 'inherit',
}
const radioLabelStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  cursor: 'pointer', padding: '0.25rem 0',
}
const cancelBtnStyle = {
  padding: '0.5rem 1rem', fontSize: '0.95em',
  border: '1px solid #ccc', background: '#fff', color: '#666',
  borderRadius: 4, cursor: 'pointer',
}
const confirmBtnStyle = {
  padding: '0.5rem 1rem', fontSize: '0.95em',
  border: 'none', background: '#222', color: '#fff',
  borderRadius: 4, cursor: 'pointer', fontWeight: 600, flex: 1,
}
