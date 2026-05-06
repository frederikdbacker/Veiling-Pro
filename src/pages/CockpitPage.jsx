import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BidStepRulesPreview from '../components/BidStepRulesPreview'
import CockpitStatusBar from '../components/CockpitStatusBar'
import SpottersStrip from '../components/SpottersStrip'
import BuyerAutocomplete from '../components/BuyerAutocomplete'
import NoteField from '../components/NoteField'
import RichNoteField, { isRichEmpty } from '../components/RichNoteField'
import Breadcrumbs from '../components/Breadcrumbs'
import { flagFromCode } from '../lib/countries'
import LogoLink from '../components/LogoLink'
import LiveInfoBar from '../components/LiveInfoBar'
import PedigreeTree from '../components/PedigreeTree'
import StarRating from '../components/StarRating'
import {
  getInterestedClientsForLot,
  getPurchasesByClientsInAuction,
  createClient,
} from '../lib/clients'
import { getSpotters } from '../lib/spotters'

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
  const { collectionId } = useParams()
  const [collection, setCollection] = useState(null)
  const [allLots, setAllLots] = useState([])
  const [activeLot, setActiveLot] = useState(null)
  const [interestedClients, setInterestedClients] = useState([])
  const [purchasesByClient, setPurchasesByClient] = useState(new Map())
  const [spotters, setSpotters] = useState([])
  const [error, setError] = useState(null)

  // Spotters laden bij wijzigen van collectionId — tonen in een kleine
  // strip tussen statusbalk en lot-picker (links → rechts in de zaal).
  useEffect(() => {
    let cancelled = false
    getSpotters(collectionId).then((list) => { if (!cancelled) setSpotters(list) })
    return () => { cancelled = true }
  }, [collectionId])

  // 1. Veiling + alle lots
  useEffect(() => {
    setCollection(null); setActiveLot(null); setAllLots([]); setError(null)
    let cancelled = false
    async function load() {
      const [collectionRes, lotsRes] = await Promise.all([
        supabase
          .from('collections')
          .select('*, online_bidding_enabled, auction_houses(id, name, logo_url)')
          .eq('id', collectionId)
          .single(),
        supabase
          .from('lots')
          .select('id, number, auction_order, is_charity, name, year, gender, studbook, size, stallion_approved, sold, sale_price, time_hammer, duration_seconds, time_entered_ring, time_bidding_start, lot_types(name_nl)')
          .eq('collection_id', collectionId)
          .order('number', { nullsFirst: false })
          .order('name'),
      ])
      if (cancelled) return
      if (collectionRes.error) { setError(collectionRes.error.message); return }
      if (lotsRes.error)    { setError(lotsRes.error.message); return }
      setCollection(collectionRes.data)
      // Sorteer: charity eerst (#6), dan op veilingvolgorde (auction_order ?? number) — #12
      const sorted = [...(lotsRes.data ?? [])].sort((a, b) => {
        if (a.is_charity && !b.is_charity) return -1
        if (!a.is_charity && b.is_charity) return 1
        const ao = a.auction_order ?? a.number
        const bo = b.auction_order ?? b.number
        if (ao == null && bo == null) return (a.name ?? '').localeCompare(b.name ?? '', 'nl')
        if (ao == null) return 1
        if (bo == null) return -1
        return ao - bo
      })
      setAllLots(sorted)
    }
    load()
    return () => { cancelled = true }
  }, [collectionId])

  // 2. Actief lot + geïnteresseerden + aankopen
  useEffect(() => {
    setActiveLot(null)
    setInterestedClients([])
    setPurchasesByClient(new Map())
    if (!collection?.active_lot_id) return
    let cancelled = false
    async function loadLot() {
      const [lotRes, clients] = await Promise.all([
        supabase
          .from('lots')
          .select('*, lot_types(name_nl)')
          .eq('id', collection.active_lot_id)
          .single(),
        getInterestedClientsForLot(collection.active_lot_id, collectionId),
      ])
      if (cancelled) return
      if (!lotRes.error) setActiveLot(lotRes.data)
      setInterestedClients(clients)
      if (clients.length > 0) {
        const map = await getPurchasesByClientsInAuction(
          collectionId,
          clients.map((c) => c.client_id),
        )
        if (!cancelled) setPurchasesByClient(map)
      }
    }
    loadLot()
    return () => { cancelled = true }
  }, [collection?.active_lot_id, collectionId])

  async function setActiveLotById(lotId) {
    const value = lotId || null
    const { error } = await supabase
      .from('collections')
      .update({ active_lot_id: value })
      .eq('id', collectionId)
    if (!error) {
      setCollection((prev) => ({ ...prev, active_lot_id: value }))
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
  if (!collection) {
    return <section><p style={{ color: 'var(--text-muted)' }}>Cockpit laden…</p></section>
  }

  const houseId   = collection.auction_houses?.id
  const houseName = collection.auction_houses?.name

  // Vorig/volgend lot — gebruikt in de picker-balk om snel door de
  // gesorteerde lijst te schuiven.
  const activeIdx = activeLot ? allLots.findIndex((l) => l.id === activeLot.id) : -1
  const prevLot = activeIdx > 0 ? allLots[activeIdx - 1] : null
  const nextLot = activeIdx >= 0 && activeIdx < allLots.length - 1
    ? allLots[activeIdx + 1]
    : null

  return (
    <section>
      {/* Sticky infobar — blijft zichtbaar tijdens scrollen (#24) */}
      <LiveInfoBar lot={activeLot} />

      <Breadcrumbs trail={[
        { label: 'Veilinghuizen', to: '/' },
        houseId && { label: houseName, to: `/houses/${houseId}` },
        { label: collection.name, to: `/collections/${collectionId}` },
        { label: 'Cockpit' },
      ].filter(Boolean)} />

      {/* Veiling-titel + datum */}
      <h1 style={titleStyle}>{collection.name}</h1>
      <p style={subtitleStyle}>
        {formatAuctionDate(collection)}
        {collection.location && ` · ${collection.location}`}
      </p>

      {/* Statusbalk */}
      <CockpitStatusBar lots={allLots} />

      {/* Spotters-strip — links → rechts zoals in de zaal opgesteld */}
      <SpottersStrip spotters={spotters} />

      {/* Overzicht-knop bij volledige veiling */}
      {allLots.length > 0 && allLots.every((l) => l.time_hammer != null) && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Link to={`/collections/${collectionId}/summary`} style={summaryBtnStyle}>
            📊 Overzicht einde veiling →
          </Link>
        </div>
      )}

      {/* Lot picker — Vorig links, dropdown midden, Volgend rechts */}
      <div style={pickerStyle}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'center', minWidth: 0 }}>
          <label style={{ fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Actief lot:
          </label>
          <select
            value={collection.active_lot_id ?? ''}
            onChange={(e) => setActiveLotById(e.target.value)}
            style={selectStyle}
          >
            <option value="">— geen lot geselecteerd —</option>
            {allLots.map((l) => {
              const order = l.auction_order ?? l.number
              return (
                <option key={l.id} value={l.id}>
                  #{order ?? '—'} {l.name}
                </option>
              )
            })}
          </select>
        </div>
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

      {!collection.active_lot_id && (
        <div>
          {collection.rundown_text ? (
            <div style={rundownStyle}>
              <h2 style={{ fontSize: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 var(--space-3) 0' }}>
                Rundown
              </h2>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                {collection.rundown_text}
              </p>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Kies hierboven welk lot in de piste is om te beginnen.
            </p>
          )}
        </div>
      )}
      {collection.active_lot_id && !activeLot && (
        <p style={{ color: 'var(--text-muted)' }}>Lot laden…</p>
      )}
      {activeLot && (
        <ActiveLotPanel
          lot={activeLot}
          collectionId={collectionId}
          houseId={houseId}
          houseLogoUrl={collection.auction_houses?.logo_url}
          onlineBiddingEnabled={!!collection.online_bidding_enabled}
          interestedClients={interestedClients}
          purchasesByClient={purchasesByClient}
          allLots={allLots}
          spotters={spotters}
          onLotUpdated={async (updated) => {
            setActiveLot((prev) => ({ ...prev, ...updated }))
            setAllLots((prev) => prev.map((l) => l.id === updated.id ? { ...l, ...updated } : l))
            if (interestedClients.length > 0) {
              const map = await getPurchasesByClientsInAuction(
                collectionId,
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
  lot, collectionId, houseId, houseLogoUrl, onlineBiddingEnabled,
  interestedClients, purchasesByClient, allLots, spotters,
  onLotUpdated, onActiveLotChange,
}) {
  const [activePhoto, setActivePhoto] = useState(0)
  const [photoOpen, setPhotoOpen] = useState(false)

  useEffect(() => { setActivePhoto(0); setPhotoOpen(false) }, [lot.id])

  const photos = Array.isArray(lot.photos) ? lot.photos : []
  const genderText = lot.gender
    ? lot.gender
      + (lot.stallion_approved ? ' ggk' : '')
      + (lot.stallion_approved && Array.isArray(lot.approved_studbooks) && lot.approved_studbooks.length > 0
          ? ` (${lot.approved_studbooks.join(', ')})`
          : '')
    : null
  const meta = [
    lot.discipline,
    formatYearAge(lot.year),
    genderText,
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
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85em', marginBottom: 'var(--space-1)' }}>
                Lot #{lot.number ?? '—'}
                {lot.lot_types?.name_nl && ` · ${lot.lot_types.name_nl}`}
              </div>
              {meta && <div style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{meta}</div>}
              <div style={{ marginTop: 'var(--space-2)' }}>
                <StarRating
                  lotId={lot.id}
                  initialValue={lot.rating}
                  size="0.95em"
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Externe links als logo-pillen — tussen basisinfo en pedigree.
              Alleen tonen wanneer URL ingevuld is. */}
          {(lot.url_hippomundo || lot.url_horsetelex || lot.url_extra) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--space-3)' }}>
              {lot.url_hippomundo && (
                <LogoLink href={lot.url_hippomundo} brand="HippoMundo" title="HippoMundo openen" />
              )}
              {lot.url_horsetelex && (
                <LogoLink href={lot.url_horsetelex} brand="Horsetelex" title="Horsetelex openen" />
              )}
              {lot.url_extra && (
                <LogoLink
                  href={lot.url_extra}
                  src={houseLogoUrl}
                  brand="Auction page"
                  title="Auction page openen"
                />
              )}
            </div>
          )}

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
            <BidStepRulesPreview collectionId={collectionId} lotTypeId={lot.lot_type_id} />
          </div>

          <div style={actionDividerStyle}>
            <CockpitControls
              lot={lot}
              houseId={houseId}
              onlineBiddingEnabled={onlineBiddingEnabled}
              interestedClients={interestedClients}
              spotters={spotters}
              allLots={allLots}
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
              const flag = flagFromCode(entry.country_code)
              const modeLabel = entry.bidding_mode === 'online' ? 'Online'
                              : entry.bidding_mode === 'phone'  ? 'Phone'
                              : 'Onsite'
              return (
                <li key={entry.client_id} style={{ padding: '4px 0' }}>
                  <div>
                    <strong style={{ color: 'var(--accent)' }}>
                      ★ {flag && <span style={{ marginRight: 4 }}>{flag}</span>}{entry.name}
                    </strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', marginLeft: 6 }}>
                      ({modeLabel})
                    </span>
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
        {!isRichEmpty(lot.notes_familie)        && <RichNoteField key={`notes_familie-${lot.id}`}        lotId={lot.id} fieldName="notes_familie"        initialValue={lot.notes_familie}        label="Familie"        compact />}
        {!isRichEmpty(lot.notes_resultaten)     && <RichNoteField key={`notes_resultaten-${lot.id}`}     lotId={lot.id} fieldName="notes_resultaten"     initialValue={lot.notes_resultaten}     label="Resultaten"     compact />}
        {!isRichEmpty(lot.notes_kenmerken)      && <RichNoteField key={`notes_kenmerken-${lot.id}`}      lotId={lot.id} fieldName="notes_kenmerken"      initialValue={lot.notes_kenmerken}      label="Kenmerken"      compact />}
        {!isRichEmpty(lot.notes_organisatie)    && <RichNoteField key={`notes_organisatie-${lot.id}`}    lotId={lot.id} fieldName="notes_organisatie"    initialValue={lot.notes_organisatie}    label="Organisatie"    compact />}
        {!isRichEmpty(lot.notes_bijzonderheden) && <RichNoteField key={`notes_bijzonderheden-${lot.id}`} lotId={lot.id} fieldName="notes_bijzonderheden" initialValue={lot.notes_bijzonderheden} label="Bijzonderheden" compact />}
      </Card>

      {/* Opmerkingen verkoop — alleen in cockpit, altijd zichtbaar (ook leeg) */}
      <Card title="Opmerkingen verkoop">
        <NoteField key={`notes_verkoop-${lot.id}`} lotId={lot.id} fieldName="notes_verkoop" initialValue={lot.notes_verkoop} compact />
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

    </div>
  )
}

function CockpitControls({ lot, houseId, onlineBiddingEnabled, interestedClients, spotters, allLots, onLotUpdated }) {
  const [busy, setBusy] = useState(null)
  const [hamerOpen, setHamerOpen] = useState(false)
  const [outcome, setOutcome] = useState('zaal')
  const [priceInput, setPriceInput] = useState('')
  const [buyer, setBuyer] = useState({ client_id: null, name: '' })
  const [spotterId, setSpotterId] = useState(null)

  useEffect(() => {
    setHamerOpen(false)
    setOutcome('zaal')
    setPriceInput('')
    setBuyer({ client_id: null, name: '' })
    setSpotterId(lot.spotter_id ?? null)
  }, [lot.id])

  const hammered = lot.time_hammer != null

  /**
   * Bereken duur op basis van vorige hamer (#23 uit roadmap).
   * Vorige lot in de gesorteerde lijst dat al ge-hamered is bepaalt
   * de starttijd. Eerste lot van de veiling: null (geen referentie).
   */
  function calcDurationSeconds() {
    if (!Array.isArray(allLots)) return null
    const idx = allLots.findIndex((l) => l.id === lot.id)
    if (idx <= 0) return null
    // Zoek het meest recente eerder lot dat al ge-hamered is
    for (let i = idx - 1; i >= 0; i--) {
      const prev = allLots[i]
      if (prev.time_hammer) {
        return Math.floor((Date.now() - new Date(prev.time_hammer).getTime()) / 1000)
      }
    }
    return null
  }

  function openHamer() {
    setHamerOpen(true)
    setOutcome('zaal')
    setPriceInput('')
    setBuyer({ client_id: null, name: '' })
    setSpotterId(lot.spotter_id ?? null)
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
          spotter_id: spotterId,
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
          spotter_id: spotterId,
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
      {/* Verkocht-resultaat na hamer */}
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

      {/* Eén grote VERKOCHT-knop (#23 uit roadmap) */}
      <div style={controlsRowStyle}>
        <button
          type="button"
          onClick={openHamer}
          disabled={hammered || busy === 'hamer-form'}
          style={hammered ? doneBtnStyle : verkochtBtnStyle}
        >
          {hammered ? '✓ Afgehandeld' : (busy === 'hamer-form' ? '…' : 'VERKOCHT')}
        </button>
      </div>

      {/* Hamer-modal — fixed-positioned, geen invloed op de DOM-tree */}
      {hamerOpen && !hammered && (
        <Modal onClose={() => setHamerOpen(false)} maxWidth={520}>
          <h3 style={{ margin: 0, marginBottom: 'var(--space-3)' }}>
            Hamer — #{lot.number ?? '—'} {lot.name}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 'var(--space-3)' }}>
            <RadioRow label="Verkocht in zaal"  value="zaal"    current={outcome} onChange={setOutcome} />
            {onlineBiddingEnabled && (
              <RadioRow label="Verkocht online" value="online"  current={outcome} onChange={setOutcome} />
            )}
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

          {/* Spotter-attributie (#26) — wie heeft het bod gemeld */}
          {Array.isArray(spotters) && spotters.length > 0 && (
            <div style={fieldRowStyle}>
              <label style={modalLabelStyle}>Spotter:</label>
              <select
                value={spotterId ?? ''}
                onChange={(e) => setSpotterId(e.target.value || null)}
                disabled={busy === 'hamer-form'}
                style={priceInputStyle}
              >
                <option value="">— geen spotter —</option>
                {spotters.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
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


/* ----- helpers ----- */

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatAuctionDate(collection) {
  if (!collection.date) return '(datum onbekend)'
  const d = new Date(collection.date)
  const datePart = d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })
  if (!collection.time_auction_start) return datePart
  const t = new Date(collection.time_auction_start)
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
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  alignItems: 'center',
  gap: 'var(--space-3)',
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
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 'var(--space-4)',
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
const rundownStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-5)',
  marginTop: 'var(--space-3)',
  maxWidth: 800,
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
const verkochtBtnStyle = {
  flex: 1,
  padding: '14px 20px',
  fontSize: '1.1rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  background: 'var(--accent)',
  color: '#fff',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const doneBtnStyle = {
  flex: 1,
  padding: '14px 20px',
  fontSize: '1.05rem',
  fontWeight: 600,
  background: 'transparent',
  color: 'var(--success)',
  border: '1px solid var(--success)',
  borderRadius: 'var(--radius-md)',
  cursor: 'default',
  fontFamily: 'inherit',
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
