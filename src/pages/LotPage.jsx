import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NoteField from '../components/NoteField'
import AutoSaveNumber from '../components/AutoSaveNumber'
import LotTypeDropdown from '../components/LotTypeDropdown'
import BidStepRulesPreview from '../components/BidStepRulesPreview'
import AutoSaveUrl from '../components/AutoSaveUrl'
import { hasMissing, translateMissing } from '../lib/missingInfo'

export default function LotPage() {
  const { lotId } = useParams()
  const navigate = useNavigate()
  const [lot, setLot] = useState(null)
  const [auction, setAuction] = useState(null)
  const [siblings, setSiblings] = useState([])
  const [status, setStatus] = useState('Laden…')
  const [activePhoto, setActivePhoto] = useState(0)

  useEffect(() => {
    // Direct state wissen bij lot-wissel zodat de input-componenten unmount-en
    // en pas opnieuw monteren mét de verse data — anders pakken ze hun
    // initialValue uit stale state en zie je lege of foute waarden.
    setLot(null)
    setAuction(null)
    setSiblings([])
    setActivePhoto(0)
    setStatus('Laden…')

    async function load() {
      // Expliciet de auction_id FK gebruiken — sinds migratie 0004 bestaat ook
      // auctions.active_lot_id → lots, dus PostgREST kan niet meer raden
      // welke relatie we willen.
      const { data, error } = await supabase
        .from('lots')
        .select('*, auctions!auction_id(id, name, auction_houses(id, name))')
        .eq('id', lotId)
        .single()

      if (error) {
        setStatus(`Fout bij ophalen lot: ${error.message}`)
        return
      }

      // Tweede query: alle lots in dezelfde veiling, voor vorig/volgend
      const sibsRes = await supabase
        .from('lots')
        .select('id, number, name')
        .eq('auction_id', data.auction_id)
        .order('number', { nullsFirst: false })
        .order('name')

      setLot(data)
      setAuction(data.auctions)
      setSiblings(sibsRes.data ?? [])
      setActivePhoto(0)
      setStatus('')
    }
    load()
  }, [lotId])

  // Prev/next op basis van positie in siblings
  const idx = siblings.findIndex((s) => s.id === lotId)
  const prev = idx > 0 ? siblings[idx - 1] : null
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null

  // Pijltjestoetsen voor prev/next — niet wanneer in een tekstveld
  useEffect(() => {
    function onKey(e) {
      const tag = e.target?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowLeft' && prev) navigate(`/lots/${prev.id}`)
      if (e.key === 'ArrowRight' && next) navigate(`/lots/${next.id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, navigate])

  if (!lot) {
    return (
      <section>
        <p style={{ color: '#666' }}>{status}</p>
      </section>
    )
  }

  const photos = Array.isArray(lot.photos) ? lot.photos : []
  const houseId = auction?.auction_houses?.id
  const houseName = auction?.auction_houses?.name

  return (
    <section>
      {/* Breadcrumb */}
      <p style={{ fontSize: '0.9em' }}>
        <Link to="/">Veilinghuizen</Link>
        {houseId && (
          <>{' › '}<Link to={`/houses/${houseId}`}>{houseName}</Link></>
        )}
        {auction && (
          <>{' › '}<Link to={`/auctions/${auction.id}`}>{auction.name}</Link></>
        )}
      </p>

      {/* Missing info banner */}
      {hasMissing(lot.missing_info) && (
        <div
          style={{
            background: '#FFF8E1', border: '1px solid #F0D585',
            borderRadius: 6, padding: '0.6rem 0.85rem', marginTop: '0.5rem',
            fontSize: '0.9em', color: '#8a6d1d',
          }}
          role="status"
        >
          ⚠ Ontbreekt voor dit lot: <strong>{translateMissing(lot.missing_info).join(', ')}</strong>
        </div>
      )}

      {/* Header */}
      <h1 style={{ marginBottom: '0.25rem' }}>
        <span style={{ color: '#999', marginRight: '0.5em' }}>
          #{lot.number ?? '—'}
        </span>
        {lot.name}
      </h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        {[lot.discipline, lot.year, lot.gender, lot.studbook, lot.size].filter(Boolean).join(' • ')}
      </p>
      {(lot.sire || lot.dam) && (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: '-0.5rem' }}>
          {lot.sire ?? '?'} × {lot.dam ?? '?'}
        </p>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <img
            src={photos[activePhoto]}
            alt={lot.name}
            style={{
              width: '100%', maxHeight: 480, objectFit: 'cover',
              borderRadius: 6, background: '#eee', display: 'block',
            }}
          />
          {photos.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {photos.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setActivePhoto(i)}
                  style={{
                    padding: 0, border: i === activePhoto ? '2px solid #222' : '2px solid transparent',
                    background: 'transparent', borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  <img
                    src={p} alt={`${lot.name} ${i + 1}`}
                    width={64} height={64} loading="lazy"
                    style={{ objectFit: 'cover', borderRadius: 2, display: 'block' }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Catalog text */}
      {lot.catalog_text && (
        <Block title="Catalogustekst">
          <p style={{ whiteSpace: 'pre-wrap' }}>{lot.catalog_text}</p>
        </Block>
      )}

      {/* EquiRatings text */}
      {lot.equiratings_text && (
        <Block title="EquiRatings">
          <p style={{ whiteSpace: 'pre-wrap' }}>{lot.equiratings_text}</p>
        </Block>
      )}

      {/* Video */}
      <Block title="Video">
        {lot.video_url ? (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 6, background: '#000' }}>
            <iframe
              src={lot.video_url}
              title={`Video van ${lot.name}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            />
          </div>
        ) : (
          <p style={{ color: '#999', fontStyle: 'italic' }}>
            Video nog niet beschikbaar
            {lot.source_url && (
              <> — origineel op <a href={lot.source_url} target="_blank" rel="noopener noreferrer">{new URL(lot.source_url).hostname}</a></>
            )}
          </p>
        )}
      </Block>

      {/* Optional fields, only shown when filled */}
      {lot.usp && <Block title="USP"><p>{lot.usp}</p></Block>}
      {lot.strong_points && <Block title="Sterke punten"><p>{lot.strong_points}</p></Block>}
      {lot.weak_points && <Block title="Aandachtspunten"><p>{lot.weak_points}</p></Block>}

      {/* Voorbereidings-velden — lot-niveau metadata die jij invult */}
      <div key={`prep-${lotId}`} style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.1em', marginBottom: '0.5rem' }}>Voorbereiding</h2>
        <LotTypeDropdown
          lotId={lotId}
          auctionId={lot.auction_id}
          currentTypeId={lot.lot_type_id}
          onSaved={(typeId) => setLot((prev) => ({ ...prev, lot_type_id: typeId }))}
        />
        <BidStepRulesPreview
          auctionId={lot.auction_id}
          lotTypeId={lot.lot_type_id}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
          <AutoSaveNumber
            table="lots"
            id={lotId}
            fieldName="number"
            initialValue={lot.number}
            label="Lot-nummer"
            step={1}
            min={1}
            placeholder="bv. 5"
            missingInfoKey="lot_number"
            onSaved={(value, newMissingInfo) => {
              setLot((prev) => ({
                ...prev,
                number: value,
                ...(newMissingInfo ? { missing_info: newMissingInfo } : {}),
              }))
            }}
          />
          <AutoSaveNumber
            table="lots"
            id={lotId}
            fieldName="start_price"
            initialValue={lot.start_price}
            label="Startprijs"
            step={100}
            min={0}
            prefix="€"
            placeholder="0"
            onSaved={(value) => setLot((prev) => ({ ...prev, start_price: value }))}
          />
          <AutoSaveNumber
            table="lots"
            id={lotId}
            fieldName="reserve_price"
            initialValue={lot.reserve_price}
            label="Reserveprijs"
            step={100}
            min={0}
            prefix="€"
            placeholder="0"
            missingInfoKey="reserve_price"
            onSaved={(value, newMissingInfo) => {
              setLot((prev) => ({
                ...prev,
                reserve_price: value,
                ...(newMissingInfo ? { missing_info: newMissingInfo } : {}),
              }))
            }}
          />
        </div>

        {/* Externe links — drie URL-placeholders */}
        <div style={{ marginTop: '1rem', maxWidth: 600 }}>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 0.4rem 0', color: '#555' }}>
            Externe links
          </h3>
          <AutoSaveUrl
            table="lots"
            id={lotId}
            fieldName="url_hippomundo"
            initialValue={lot.url_hippomundo}
            label="Hippomundo"
            placeholder="https://www.hippomundo.com/..."
            onSaved={(value) => setLot((prev) => ({ ...prev, url_hippomundo: value }))}
          />
          <AutoSaveUrl
            table="lots"
            id={lotId}
            fieldName="url_horsetelex"
            initialValue={lot.url_horsetelex}
            label="Horsetelex"
            placeholder="https://www.horsetelex.com/..."
            onSaved={(value) => setLot((prev) => ({ ...prev, url_horsetelex: value }))}
          />
          <AutoSaveUrl
            table="lots"
            id={lotId}
            fieldName="url_extra"
            initialValue={lot.url_extra}
            label="Extra"
            placeholder="https://..."
            onSaved={(value) => setLot((prev) => ({ ...prev, url_extra: value }))}
          />
        </div>
      </div>

      {/* Notitievelden — auto-save 800ms na laatste toets */}
      <div key={lotId} style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.1em', marginBottom: '0.5rem' }}>Mijn notities</h2>
        <NoteField
          lotId={lotId}
          fieldName="notes_catalog"
          initialValue={lot.notes_catalog}
          label="Catalogus"
        />
        <NoteField
          lotId={lotId}
          fieldName="notes_video"
          initialValue={lot.notes_video}
          label="Video"
        />
        <NoteField
          lotId={lotId}
          fieldName="notes_org"
          initialValue={lot.notes_org}
          label="Organisatie"
        />
      </div>

      {/* Vorig/volgend lot — pijltjestoetsen werken ook (buiten tekstvelden) */}
      <nav
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '1rem', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #ddd',
        }}
      >
        <NavLink lot={prev} dir="prev" />
        <small style={{ color: '#999' }}>
          {idx >= 0 && `${idx + 1} / ${siblings.length}`}
        </small>
        <NavLink lot={next} dir="next" />
      </nav>
    </section>
  )
}

function NavLink({ lot, dir }) {
  const arrow = dir === 'prev' ? '←' : '→'
  const align = dir === 'prev' ? 'left' : 'right'
  if (!lot) {
    return (
      <span style={{ color: '#bbb', flex: 1, textAlign: align }}>
        {dir === 'prev' ? `${arrow} Begin` : `Einde ${arrow}`}
      </span>
    )
  }
  const label = `#${lot.number ?? '—'} ${lot.name}`
  return (
    <Link
      to={`/lots/${lot.id}`}
      style={{ flex: 1, textAlign: align, textDecoration: 'none', color: '#222' }}
    >
      {dir === 'prev' ? `${arrow} ${label}` : `${label} ${arrow}`}
    </Link>
  )
}

function Block({ title, children }) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h2 style={{ fontSize: '1.1em', marginBottom: '0.4rem' }}>{title}</h2>
      {children}
    </div>
  )
}
