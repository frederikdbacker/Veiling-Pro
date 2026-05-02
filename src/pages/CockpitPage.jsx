import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BidStepRulesPreview from '../components/BidStepRulesPreview'
import CockpitStatusBar from '../components/CockpitStatusBar'
import BuyerAutocomplete from '../components/BuyerAutocomplete'
import NoteField from '../components/NoteField'
import PedigreeTree from '../components/PedigreeTree'
import {
  getInterestedClientsForLot,
  getPurchasesByClientsInAuction,
  createClient,
} from '../lib/clients'

/**
 * Live Cockpit — wat Frederik gebruikt tijdens de veiling.
 *
 * Layout-prioriteit (per Frederiks feedback 02-05-2026):
 *   - Compacte paardidentiteit (kleine thumb, geen grote foto)
 *   - Geïnteresseerden + biedstappen prominent naast elkaar
 *   - "Mijn voorbereiding" als grote sectie (auto-save NoteFields)
 *   - Drie-knop-flow compact, op één regel
 *   - Hamer-form als modal-overlay
 *   - Catalogustekst en EquiRatings ingeklapt (klap open indien nodig)
 */
export default function CockpitPage() {
  const { auctionId } = useParams()
  const [auction, setAuction] = useState(null)
  const [allLots, setAllLots] = useState([])
  const [activeLot, setActiveLot] = useState(null)
  const [interestedClients, setInterestedClients] = useState([])
  const [purchasesByClient, setPurchasesByClient] = useState(new Map())
  const [error, setError] = useState(null)

  // 1. Veiling + alle lots
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
          .select('id, number, name, year, gender, studbook, size, sold, sale_price, time_hammer, duration_seconds, time_entered_ring, time_bidding_start')
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

  // 2. Actief lot + geïnteresseerden + aankopen
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
      <section>
        <p style={{ color: 'var(--danger)' }}>❌ {error}</p>
        <p><Link to="/">← Terug naar start</Link></p>
      </section>
    )
  }
  if (!auction) {
    return <section><p style={{ color: 'var(--text-muted)' }}>Cockpit laden…</p></section>
  }

  const houseId   = auction.auction_houses?.id
  const houseName = auction.auction_houses?.name

  // Vorig/volgend lot — gebruikt in de picker-balk om snel door de
  // gesorteerde lijst te schuiven.
  const activeIdx = activeLot ? allLots.findIndex((l) => l.id === activeLot.id) : -1
  const prevLot = activeIdx > 0 ? allLots[activeIdx - 1] : null
  const nextLot = activeIdx >= 0 && activeIdx < allLots.length - 1
    ? allLots[activeIdx + 1]
    : null

  return (
    <section>
      {/* Breadcrumbs */}
      <p style={crumbsStyle}>
        <Link to="/" style={crumbStyle}>Veilinghuizen</Link>
        {houseId && <>{' › '}<Link to={`/houses/${houseId}`} style={crumbStyle}>{houseName}</Link></>}
        {' › '}<Link to={`/auctions/${auctionId}`} style={crumbStyle}>{auction.name}</Link>
        {' › '}<span style={{ color: 'var(--text-secondary)' }}>Cockpit</span>
      </p>

      {/* Veiling-titel + datum */}
      <h1 style={titleStyle}>{auction.name}</h1>
      <p style={subtitleStyle}>
        {formatAuctionDate(auction)}
        {auction.location && ` · ${auction.location}`}
      </p>

      {/* Statusbalk */}
      <CockpitStatusBar lots={allLots} />

      {/* Overzicht-knop bij volledige veiling */}
      {allLots.length > 0 && allLots.every((l) => l.time_hammer != null) && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Link to={`/auctions/${auctionId}/summary`} style={summaryBtnStyle}>
            📊 Overzicht einde veiling →
          </Link>
        </div>
      )}

      {/* Lot picker — dropdown links, Vorig en Volgend knoppen rechts */}
      <div style={pickerStyle}>
        <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
          Actief lot:
        </label>
        <select
          value={auction.active_lot_id ?? ''}
          onChange={(e) => setActiveLotById(e.target.value)}
          style={selectStyle}
        >
          <option value="">— geen lot geselecteerd —</option>
          {allLots.map((l) => {
            const extras = [
              formatYearAge(l.year),
              l.gender,
              l.studbook,
              l.size,
            ].filter(Boolean).join(' · ')
            return (
              <option key={l.id} value={l.id}>
                #{l.number ?? '—'} {l.name}{extras && ` — ${extras}`}
              </option>
            )
          })}
        </select>
        <button
          onClick={() => prevLot && setActiveLotById(prevLot.id)}
          disabled={!prevLot}
          style={navBtnStyle(prevLot != null)}
          title={prevLot ? `Vorig lot — #${prevLot.number ?? '—'} ${prevLot.name}` : 'Begin van de lijst'}
        >
          {prevLot
            ? `← Vorig · #${prevLot.number ?? '—'} ${prevLot.name}`
            : '← Begin'}
        </button>
        <button
          onClick={() => nextLot && setActiveLotById(nextLot.id)}
          disabled={!nextLot}
          style={navBtnStyle(nextLot != null)}
          title={nextLot ? `Volgend lot — #${nextLot.number ?? '—'} ${nextLot.name}` : 'Einde van de lijst'}
        >
          {nextLot
            ? `Volgend · #${nextLot.number ?? '—'} ${nextLot.name} →`
            : 'Einde →'}
        </button>
      </div>

      {!auction.active_lot_id && (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Kies hierboven welk lot in de piste is om te beginnen.
        </p>
      )}
      {auction.active_lot_id && !activeLot && (
        <p style={{ color: 'var(--text-muted)' }}>Lot laden…</p>
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
    </section>
  )
}

function ActiveLotPanel({
  lot, auctionId, houseId, interestedClients, purchasesByClient, allLots,
  onLotUpdated, onActiveLotChange,
}) {
  const [activePhoto, setActivePhoto] = useState(0)
  const [photoOpen, setPhotoOpen] = useState(false)

  useEffect(() => { setActivePhoto(0); setPhotoOpen(false) }, [lot.id])

  const photos = Array.isArray(lot.photos) ? lot.photos : []
  const meta = [
    lot.discipline,
    formatYearAge(lot.year),
    lot.gender,
    lot.studbook,
    lot.size,
  ].filter(Boolean).join(' · ')

  return (
    <div>
      {/* Lot-card: twee kolommen — identity links, actie-kader rechts.
          Het actie-kader bundelt prijzen, biedstappen, timer en knoppen
          omdat dat tijdens veilen samenhoort. */}
      <div style={lotCardTwoColStyle}>
        {/* Identity-kolom: basis-info bovenaan, pedigree-tree daaronder */}
        <div style={identityColStyle}>
          <div style={identityHeaderRowStyle}>
            {photos.length > 0 && (
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                title="Bekijk foto's"
                style={thumbBtnStyle}
                aria-label="Open fotogalerij"
              >
                <img
                  src={photos[activePhoto]}
                  alt={lot.name}
                  width={88} height={88}
                  style={{ objectFit: 'cover', display: 'block', borderRadius: 'var(--radius-sm)' }}
                />
              </button>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Paardennaam staat al in de dropdown bovenaan — niet
                  herhalen. Hier alleen lot-nummer + type + meta-info. */}
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85em', marginBottom: 'var(--space-1)' }}>
                Lot #{lot.number ?? '—'}
                {lot.lot_types?.name_nl && ` · ${lot.lot_types.name_nl}`}
              </div>
              {meta && <div style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{meta}</div>}
            </div>
          </div>

          {/* Pedigree direct onder de basisinfo, vult de vrije ruimte naast
              het actie-kader rechts */}
          <div style={pedigreeInLotStyle}>
            <div style={actionSubtitleStyle}>Pedigree</div>
            <PedigreeTree pedigree={lot.pedigree} />
          </div>
        </div>

        {/* Actie-kader: prijzen → biedstappen → timer + 3-knop-flow */}
        <div style={actionPanelStyle}>
          <div style={priceBlockStyle} className="num">
            <div>
              <span style={priceLabelStyle}>Start</span>{' '}
              <strong>€{formatNum(lot.start_price)}</strong>
            </div>
            {lot.reserve_price != null && (
              <div>
                <span style={priceLabelStyle}>Reserve</span>{' '}
                <strong>€{formatNum(lot.reserve_price)}</strong>
              </div>
            )}
          </div>

          <div style={actionDividerStyle}>
            <div style={actionSubtitleStyle}>Biedstappen</div>
            <BidStepRulesPreview auctionId={auctionId} lotTypeId={lot.lot_type_id} />
          </div>

          <div style={actionDividerStyle}>
            <CockpitControls
              lot={lot}
              houseId={houseId}
              interestedClients={interestedClients}
              onLotUpdated={onLotUpdated}
            />
          </div>
        </div>
      </div>

      {/* Fotomodal */}
      {photoOpen && photos.length > 0 && (
        <Modal onClose={() => setPhotoOpen(false)} maxWidth={720}>
          <h3 style={{ margin: 0, marginBottom: 'var(--space-3)' }}>{lot.name} — foto's</h3>
          <img
            src={photos[activePhoto]}
            alt={lot.name}
            style={{
              width: '100%', maxHeight: 480, objectFit: 'contain',
              background: '#000', borderRadius: 'var(--radius-md)',
            }}
          />
          {photos.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
              {photos.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setActivePhoto(i)}
                  style={{
                    padding: 0,
                    border: i === activePhoto
                      ? '2px solid var(--accent)'
                      : '2px solid transparent',
                    background: 'transparent',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <img src={p} alt="" width={56} height={56} loading="lazy"
                    style={{ objectFit: 'cover', borderRadius: 2, display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Geïnteresseerden — volle breedte (biedstappen verhuisden naar
          actie-kader binnen de lot-card) */}
      <Card title="Geïnteresseerden">
        {interestedClients.length === 0 ? (
          <p style={emptyMutedStyle}>
            Nog geen klanten gekoppeld. Voeg ze toe op de lot-detailpagina.
          </p>
        ) : (
          <ul style={listStyle}>
            {interestedClients.map((entry) => {
              const purchases = purchasesByClient?.get(entry.client_id)
              const meta = []
              if (entry.table_number) meta.push(`tafel ${entry.table_number}`)
              if (entry.direction)    meta.push(entry.direction)
              return (
                <li key={entry.client_id} style={{ padding: '4px 0' }}>
                  <div>
                    <strong style={{ color: 'var(--accent)' }}>★ {entry.name}</strong>
                    {meta.length > 0 && (
                      <span style={{ color: 'var(--text-secondary)' }}> · {meta.join(' · ')}</span>
                    )}
                  </div>
                  {entry.seating_notes && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9em', fontStyle: 'italic' }}>
                      "{entry.seating_notes}"
                    </div>
                  )}
                  {entry.lot_notes && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>
                      ↪ specifiek: {entry.lot_notes}
                    </div>
                  )}
                  {purchases && purchases.length > 0 && (
                    <div style={purchasedStyle}>
                      ✓ al gekocht: {purchases.map((p) => `#${p.number ?? '—'} ${p.name}`).join(', ')}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* Catalogustekst — uitgeklapt, vóór "Mijn voorbereiding" zodat je
          tijdens het voorlezen direct je notities ernaast hebt */}
      {lot.catalog_text && (
        <Card title="Catalogustekst">
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>
            {lot.catalog_text}
          </p>
        </Card>
      )}

      {/* Mijn voorbereiding */}
      <Card title="Mijn voorbereiding">
        <NoteField key={`notes_catalog-${lot.id}`} lotId={lot.id} fieldName="notes_catalog" initialValue={lot.notes_catalog} label="Catalogus" />
        <NoteField key={`notes_video-${lot.id}`}   lotId={lot.id} fieldName="notes_video"   initialValue={lot.notes_video}   label="Video" />
        <NoteField key={`notes_org-${lot.id}`}     lotId={lot.id} fieldName="notes_org"     initialValue={lot.notes_org}     label="Organisatie" />
      </Card>

      {/* EquiRatings blijft uitklapbaar (minder vaak nodig tijdens veilen) */}
      {lot.equiratings_text && (
        <details style={detailsStyle}>
          <summary style={summaryStyle}>EquiRatings</summary>
          <p style={{ whiteSpace: 'pre-wrap', margin: '0.5rem 0 0 0', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
            {lot.equiratings_text}
          </p>
        </details>
      )}

      {/* Externe links — pillen */}
      {(lot.url_hippomundo || lot.url_horsetelex || lot.url_extra) && (
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {lot.url_hippomundo && <ExternalLink href={lot.url_hippomundo} label="Hippomundo" />}
          {lot.url_horsetelex && <ExternalLink href={lot.url_horsetelex} label="Horsetelex" />}
          {lot.url_extra      && <ExternalLink href={lot.url_extra}      label="Extra" />}
        </div>
      )}
    </div>
  )
}

function CockpitControls({ lot, houseId, interestedClients, onLotUpdated }) {
  const [now, setNow] = useState(() => new Date())
  const [busy, setBusy] = useState(null)
  const [hamerOpen, setHamerOpen] = useState(false)
  const [outcome, setOutcome] = useState('zaal')
  const [priceInput, setPriceInput] = useState('')
  const [buyer, setBuyer] = useState({ client_id: null, name: '' })

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setHamerOpen(false)
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
    return Math.floor((Date.now() - new Date(lot.time_entered_ring).getTime()) / 1000)
  }

  function openHamer() {
    setHamerOpen(true)
    setOutcome('zaal')
    setPriceInput('')
    setBuyer({ client_id: null, name: '' })
  }

  async function resolveBuyer() {
    if (buyer.client_id) {
      return { id: buyer.client_id, name: (buyer.name || '').trim() || null }
    }
    const trimmed = (buyer.name || '').trim()
    if (!trimmed) return { id: null, name: null }
    if (!houseId) throw new Error('Veilinghuis-id ontbreekt — kan koper niet aanmaken.')
    const created = await createClient(houseId, trimmed)
    return { id: created.id, name: created.name }
  }

  async function commitHamer() {
    const trimmed = priceInput.trim()
    if (outcome === 'zaal' || outcome === 'online') {
      if (!trimmed) { alert('Vul de verkoopprijs in.'); return }
      const price = Number(trimmed)
      if (Number.isNaN(price) || price < 0) { alert('Verkoopprijs is geen geldig getal.'); return }
      setBusy('hamer-form')
      let resolved
      try { resolved = await resolveBuyer() }
      catch (e) { setBusy(null); alert(`Fout bij koper: ${e.message}`); return }
      const { data, error } = await supabase
        .from('lots')
        .update({
          time_hammer: new Date().toISOString(),
          sale_price: price,
          sold: true,
          sale_channel: outcome,
          duration_seconds: calcDurationSeconds(),
          buyer_client_id: resolved.id,
          buyer: resolved.name,
        })
        .eq('id', lot.id)
        .select()
        .single()
      setBusy(null)
      if (error) { alert(`Fout: ${error.message}`); return }
      if (data) { onLotUpdated(data); setHamerOpen(false) }
    } else {
      let highestBid = null
      if (trimmed !== '') {
        const n = Number(trimmed)
        if (Number.isNaN(n) || n < 0) { alert('Hoogste bod is geen geldig getal.'); return }
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
      if (data) { onLotUpdated(data); setHamerOpen(false) }
    }
  }

  return (
    <>
      {/* Live timer + resultaat */}
      {!hammered && (
        <div style={{ ...timersStyle, color: 'var(--text-secondary)' }}>
          {inRing && (
            <span>⏱ <strong style={{ color: 'var(--text-primary)' }}>{formatElapsed(now - new Date(lot.time_entered_ring))}</strong> in piste</span>
          )}
          {bidding && (
            <span style={{ marginLeft: '1rem' }}>
              ⏱ <strong style={{ color: 'var(--text-primary)' }}>{formatElapsed(now - new Date(lot.time_bidding_start))}</strong> bieden
            </span>
          )}
          {!inRing && (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Klik "In piste" zodra het paard binnenkomt.
            </span>
          )}
        </div>
      )}

      {hammered && (
        <div style={{ ...timersStyle, color: lot.sold ? 'var(--success)' : 'var(--warning)' }}>
          {lot.sold
            ? `✓ Verkocht ${lot.sale_channel === 'zaal' ? 'in zaal' : lot.sale_channel === 'online' ? 'online' : ''}`.trim()
            : '⊘ Niet verkocht'}
          {lot.sale_price != null && ` — €${formatNum(lot.sale_price)}`}
          {' om '}{new Date(lot.time_hammer).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
          {lot.duration_seconds != null && ` (duur ${formatElapsed(lot.duration_seconds * 1000)})`}
        </div>
      )}

      {/* 3-knop-flow — Volgend lot zit in de picker-balk bovenaan */}
      <div style={controlsRowStyle}>
        <FlowButton
          label="In piste" state={inRingState}
          busy={busy === 'in-ring'}
          onClick={() => patchTimestamp('time_entered_ring', 'in-ring')}
        />
        <FlowButton
          label="Start bieden" state={startState}
          busy={busy === 'start'}
          onClick={() => patchTimestamp('time_bidding_start', 'start')}
        />
        <FlowButton
          label="Hamer" state={hammerState}
          busy={busy === 'hamer-form'}
          onClick={openHamer}
          primary
        />
      </div>

      {/* Hamer-modal — fixed-positioned, geen invloed op de DOM-tree */}
      {hamerOpen && bidding && !hammered && (
        <Modal onClose={() => setHamerOpen(false)} maxWidth={520}>
          <h3 style={{ margin: 0, marginBottom: 'var(--space-3)' }}>
            Hamer — #{lot.number ?? '—'} {lot.name}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 'var(--space-3)' }}>
            <RadioRow label="Verkocht in zaal"  value="zaal"    current={outcome} onChange={setOutcome} />
            <RadioRow label="Verkocht online"   value="online"  current={outcome} onChange={setOutcome} />
            <RadioRow label="Niet verkocht"     value="unsold"  current={outcome} onChange={setOutcome} />
          </div>

          <div style={fieldRowStyle}>
            <label style={modalLabelStyle}>
              {outcome === 'unsold' ? 'Hoogste bod:' : 'Verkoopprijs:'}
            </label>
            <span style={{ color: 'var(--text-muted)' }}>€</span>
            <input
              type="text" inputMode="numeric"
              value={priceInput === '' ? '' : Number(priceInput).toLocaleString('nl-BE', { maximumFractionDigits: 0 })}
              onChange={(e) => setPriceInput(e.target.value.replace(/[^\d]/g, ''))}
              placeholder={outcome === 'unsold' ? 'optioneel' : 'bv. 15.000'}
              style={priceInputStyle}
              autoFocus
            />
          </div>

          {(outcome === 'zaal' || outcome === 'online') && (
            <div style={fieldRowStyle}>
              <label style={modalLabelStyle}>Koper:</label>
              <BuyerAutocomplete
                houseId={houseId}
                priorityClients={interestedClients}
                value={buyer}
                onChange={setBuyer}
                disabled={busy === 'hamer-form'}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-4)' }}>
            <button onClick={() => setHamerOpen(false)} disabled={busy === 'hamer-form'} style={cancelBtnStyle}>
              Annuleer
            </button>
            <button onClick={commitHamer} disabled={busy === 'hamer-form'} style={confirmBtnStyle}>
              {busy === 'hamer-form' ? '…' : '✓ Bevestig hamer'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function FlowButton({ label, state, busy, onClick, primary }) {
  const stateStyles = {
    pending: {
      background: 'var(--bg-input)',
      color: 'var(--text-muted)',
      cursor: 'not-allowed',
      opacity: 0.6,
      border: '1px solid var(--border-default)',
    },
    active: primary ? {
      background: 'var(--accent)',
      color: 'var(--bg-base)',
      cursor: 'pointer',
      border: '1px solid var(--accent)',
      fontWeight: 700,
    } : {
      background: 'var(--bg-elevated)',
      color: 'var(--text-primary)',
      cursor: 'pointer',
      border: '1px solid var(--accent-muted)',
      fontWeight: 600,
    },
    done: {
      background: 'transparent',
      color: 'var(--success)',
      cursor: 'default',
      opacity: 0.85,
      border: '1px solid var(--success)',
    },
  }[state]

  return (
    <button
      onClick={state === 'active' && !busy ? onClick : undefined}
      disabled={state !== 'active' || busy}
      style={{
        padding: '0.5rem 0.85rem',
        fontSize: '0.95rem',
        borderRadius: 'var(--radius-sm)',
        ...stateStyles,
      }}
    >
      {state === 'done' ? '✓ ' : ''}{busy ? '…' : label}
    </button>
  )
}

function RadioRow({ label, value, current, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input
        type="radio" name="outcome"
        value={value} checked={current === value}
        onChange={() => onChange(value)}
      />
      <span>{label}</span>
    </label>
  )
}

function Card({ title, children, defaultOpen = true }) {
  return (
    <details open={defaultOpen} style={cardStyle}>
      <summary style={cardTitleStyle}>{title}</summary>
      <div style={{ marginTop: 'var(--space-3)' }}>{children}</div>
    </details>
  )
}

function Modal({ children, onClose, maxWidth = 600 }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div
        style={{ ...modalContentStyle, maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true"
      >
        <button
          onClick={onClose}
          aria-label="Sluit"
          style={modalCloseStyle}
        >✕</button>
        {children}
      </div>
    </div>
  )
}

function ExternalLink({ href, label }) {
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '0.3rem 0.7rem',
        background: 'var(--bg-elevated)', color: 'var(--accent)',
        textDecoration: 'none', borderRadius: 'var(--radius-full)',
        fontSize: '0.85rem',
        border: '1px solid var(--border-default)',
      }}
    >
      🔗 {label}
    </a>
  )
}

/* ----- helpers ----- */

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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

/* ----- styles ----- */

const crumbsStyle = {
  fontSize: '0.85rem',
  color: 'var(--text-muted)',
  margin: '0 0 var(--space-2) 0',
}
const crumbStyle = { color: 'var(--text-muted)', textDecoration: 'none' }
const titleStyle = {
  margin: '0 0 var(--space-1) 0',
  color: 'var(--text-primary)',
  letterSpacing: '0.01em',
}
const subtitleStyle = {
  color: 'var(--text-secondary)',
  marginTop: 0,
  marginBottom: 'var(--space-4)',
}
const summaryBtnStyle = {
  display: 'inline-block',
  padding: 'var(--space-2) var(--space-4)',
  background: 'var(--success)',
  color: '#fff',
  borderRadius: 'var(--radius-sm)',
  textDecoration: 'none',
  fontWeight: 600,
}
const pickerStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-4)',
  marginBottom: 'var(--space-4)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  flexWrap: 'wrap',
}
const selectStyle = {
  flex: '1 1 16em',
  padding: '0.4rem 0.5rem', fontSize: '1rem',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  minWidth: '12em',
}
const lotCardTwoColStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 'var(--space-4)',
  padding: 'var(--space-4)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  marginBottom: 'var(--space-4)',
}
const identityColStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  minWidth: 0,
}
const identityHeaderRowStyle = {
  display: 'flex',
  gap: 'var(--space-4)',
  alignItems: 'flex-start',
}
const pedigreeInLotStyle = {
  marginTop: 'auto',
  paddingTop: 'var(--space-3)',
  borderTop: '1px solid var(--border-default)',
}
const actionPanelStyle = {
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-4)',
}
const actionDividerStyle = {
  marginTop: 'var(--space-3)',
  paddingTop: 'var(--space-3)',
  borderTop: '1px solid var(--border-default)',
}
const actionSubtitleStyle = {
  fontSize: '0.75rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 'var(--space-2)',
}
const priceBlockStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  fontSize: '1.05rem',
  color: 'var(--text-primary)',
}
const priceLabelStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginRight: 4,
}
const thumbBtnStyle = {
  padding: 0, border: 'none', background: 'transparent',
  cursor: 'pointer', flexShrink: 0,
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
}
const lotNameStyle = {
  margin: '0.1rem 0 0.3rem 0',
  fontSize: '1.6rem',
  color: 'var(--text-primary)',
  fontWeight: 600,
}
const cardStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4)',
  marginBottom: 'var(--space-4)',
}
const cardTitleStyle = {
  fontSize: '0.85rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  cursor: 'pointer',
  userSelect: 'none',
  outline: 'none',
}
const listStyle = { listStyle: 'none', padding: 0, margin: 0 }
const emptyMutedStyle = { color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }
const purchasedStyle = {
  marginTop: 4,
  color: 'var(--success)',
  fontSize: '0.85em',
  fontWeight: 600,
}
const timersStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '1rem',
  fontVariantNumeric: 'tabular-nums',
}
const controlsRowStyle = {
  display: 'flex', flexWrap: 'wrap', gap: 8,
  marginTop: 'var(--space-3)',
  alignItems: 'center',
}
const detailsStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-4)',
  marginBottom: 'var(--space-3)',
}
const summaryStyle = {
  cursor: 'pointer',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  fontSize: '0.85rem',
}

const navBtnStyle = (enabled) => ({
  padding: '0.5rem 0.85rem',
  fontSize: '0.9rem',
  background: 'transparent',
  color: enabled ? 'var(--accent)' : 'var(--text-muted)',
  border: '1px solid ' + (enabled ? 'var(--accent-muted)' : 'var(--border-default)'),
  borderRadius: 'var(--radius-sm)',
  cursor: enabled ? 'pointer' : 'not-allowed',
  whiteSpace: 'nowrap',
})

const fieldRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--space-2)',
  flexWrap: 'wrap',
}
const modalLabelStyle = {
  minWidth: '6.5em',
  color: 'var(--text-secondary)',
  fontWeight: 600,
}
const priceInputStyle = {
  flex: 1, minWidth: '8em',
  padding: '0.45rem 0.6rem',
  fontSize: '1rem',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)',
}
const cancelBtnStyle = {
  padding: '0.5rem 1rem',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
}
const confirmBtnStyle = {
  flex: 1,
  padding: '0.5rem 1rem',
  background: 'var(--accent)',
  color: 'var(--bg-base)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontWeight: 700,
}

const modalBackdropStyle = {
  position: 'fixed', inset: 0,
  background: 'var(--bg-overlay)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100,
  padding: 'var(--space-4)',
}
const modalContentStyle = {
  position: 'relative',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  width: '100%',
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: 'var(--shadow-lg)',
}
const modalCloseStyle = {
  position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)',
  width: 32, height: 32,
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
}
