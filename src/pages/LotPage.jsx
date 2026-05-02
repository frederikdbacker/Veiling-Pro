import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NoteField from '../components/NoteField'
import AutoSaveNumber from '../components/AutoSaveNumber'
import LotTypeDropdown from '../components/LotTypeDropdown'
import AutoSaveUrl from '../components/AutoSaveUrl'
import InterestedClientsField from '../components/InterestedClientsField'
import PedigreeTree from '../components/PedigreeTree'
import EditableLongText from '../components/EditableLongText'
import Modal from '../components/Modal'
import { hasMissing, translateMissing } from '../lib/missingInfo'

export default function LotPage() {
  const { lotId } = useParams()
  const navigate = useNavigate()
  const [lot, setLot] = useState(null)
  const [auction, setAuction] = useState(null)
  const [siblings, setSiblings] = useState([])
  const [status, setStatus] = useState('Laden…')
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [activePhoto, setActivePhoto] = useState(0)

  useEffect(() => {
    setLot(null)
    setAuction(null)
    setSiblings([])
    setActivePhoto(0)
    setPhotoModalOpen(false)
    setStatus('Laden…')

    async function load() {
      const { data, error } = await supabase
        .from('lots')
        .select('*, auctions!auction_id(id, name, auction_houses(id, name))')
        .eq('id', lotId)
        .single()

      if (error) {
        setStatus(`Fout bij ophalen lot: ${error.message}`)
        return
      }

      const sibsRes = await supabase
        .from('lots')
        .select('id, number, name')
        .eq('auction_id', data.auction_id)
        .order('number', { nullsFirst: false })
        .order('name')

      setLot(data)
      setAuction(data.auctions)
      setSiblings(sibsRes.data ?? [])
      setStatus('')
    }
    load()
  }, [lotId])

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
    return <section><p style={{ color: 'var(--text-muted)' }}>{status}</p></section>
  }

  const photos = Array.isArray(lot.photos) ? lot.photos : []
  const houseId = auction?.auction_houses?.id
  const houseName = auction?.auction_houses?.name
  const meta = [lot.discipline, lot.year, lot.gender, lot.studbook, lot.size]
    .filter(Boolean).join(' · ')

  return (
    <section>
      {/* Breadcrumb */}
      <p style={crumbsStyle}>
        <Link to="/" style={crumbStyle}>Veilinghuizen</Link>
        {houseId && <>{' › '}<Link to={`/houses/${houseId}`} style={crumbStyle}>{houseName}</Link></>}
        {auction && <>{' › '}<Link to={`/auctions/${auction.id}`} style={crumbStyle}>{auction.name}</Link></>}
      </p>

      {/* Missing info banner */}
      {hasMissing(lot.missing_info) && (
        <div style={missingBannerStyle} role="status">
          ⚠ Ontbreekt voor dit lot: <strong>{translateMissing(lot.missing_info).join(', ')}</strong>
        </div>
      )}

      {/* Header — kleine klikbare thumbnail naast lot-nummer + naam + meta */}
      <div style={headerRowStyle}>
        {photos.length > 0 && (
          <button
            type="button"
            onClick={() => setPhotoModalOpen(true)}
            title="Bekijk foto's"
            style={thumbBtnStyle}
            aria-label="Open fotogalerij"
          >
            <img
              src={photos[0]}
              alt={lot.name}
              width={96} height={96}
              style={{ objectFit: 'cover', display: 'block', borderRadius: 'var(--radius-sm)' }}
            />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={lotTitleStyle}>
            <span style={{ color: 'var(--text-muted)', marginRight: '0.4em' }}>
              #{lot.number ?? '—'}
            </span>
            {lot.name}
          </h1>
          {meta && <p style={metaStyle}>{meta}</p>}
        </div>
      </div>

      {/* Foto-modal — opent enkel bij klik op thumbnail */}
      {photoModalOpen && photos.length > 0 && (
        <Modal onClose={() => setPhotoModalOpen(false)} maxWidth={840}>
          <h3 style={{ margin: 0, marginBottom: 'var(--space-3)' }}>{lot.name} — foto's</h3>
          <img
            src={photos[activePhoto]}
            alt={lot.name}
            style={{
              width: '100%', maxHeight: 540, objectFit: 'contain',
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
                  <img src={p} alt="" width={64} height={64} loading="lazy"
                    style={{ objectFit: 'cover', borderRadius: 2, display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Lot-nummer + prijzen + lot-type — alles op één rij onder de naam.
          Biedstappen worden niet getoond op LotPage (zit op de cockpit). */}
      <Block title="Lot & prijzen" key={`prep-${lotId}`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', alignItems: 'flex-end' }}>
          <AutoSaveNumber
            table="lots" id={lotId} fieldName="number"
            initialValue={lot.number} label="Lot-nummer"
            step={1} min={1} placeholder="bv. 5"
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
            table="lots" id={lotId} fieldName="start_price"
            initialValue={lot.start_price} label="Startprijs"
            step={100} min={0} prefix="€" placeholder="0"
            displayWithThousands
            onSaved={(value) => setLot((prev) => ({ ...prev, start_price: value }))}
          />
          <AutoSaveNumber
            table="lots" id={lotId} fieldName="reserve_price"
            initialValue={lot.reserve_price} label="Reserveprijs"
            step={100} min={0} prefix="€" placeholder="0"
            displayWithThousands
            missingInfoKey="reserve_price"
            onSaved={(value, newMissingInfo) => {
              setLot((prev) => ({
                ...prev,
                reserve_price: value,
                ...(newMissingInfo ? { missing_info: newMissingInfo } : {}),
              }))
            }}
          />
          <LotTypeDropdown
            lotId={lotId}
            auctionId={lot.auction_id}
            currentTypeId={lot.lot_type_id}
            onSaved={(typeId) => setLot((prev) => ({ ...prev, lot_type_id: typeId }))}
          />
        </div>
      </Block>

      {/* Pedigree — onder de prijzen */}
      <Block title="Pedigree">
        <PedigreeTree pedigree={lot.pedigree} />
      </Block>

      {/* Externe links — direct onder pedigree, drie naast elkaar */}
      <Block title="Externe links">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <AutoSaveUrl
            table="lots" id={lotId} fieldName="url_hippomundo"
            initialValue={lot.url_hippomundo} label="Hippomundo"
            placeholder="https://www.hippomundo.com/..."
            compact
            onSaved={(value) => setLot((prev) => ({ ...prev, url_hippomundo: value }))}
          />
          <AutoSaveUrl
            table="lots" id={lotId} fieldName="url_horsetelex"
            initialValue={lot.url_horsetelex} label="Horsetelex"
            placeholder="https://www.horsetelex.com/..."
            compact
            onSaved={(value) => setLot((prev) => ({ ...prev, url_horsetelex: value }))}
          />
          <AutoSaveUrl
            table="lots" id={lotId} fieldName="url_extra"
            initialValue={lot.url_extra} label="Extra"
            placeholder="https://..."
            compact
            onSaved={(value) => setLot((prev) => ({ ...prev, url_extra: value }))}
          />
        </div>
      </Block>

      {/* Catalogustekst — bewerkbaar via ✏ als de scrape niets vond */}
      <Block title="Catalogustekst">
        <EditableLongText
          key={`cat-${lotId}`}
          id={lotId}
          fieldName="catalog_text"
          initialValue={lot.catalog_text}
          placeholder="catalogustekst"
        />
      </Block>

      {/* EquiRatings — idem bewerkbaar */}
      <Block title="EquiRatings">
        <EditableLongText
          key={`equi-${lotId}`}
          id={lotId}
          fieldName="equiratings_text"
          initialValue={lot.equiratings_text}
          placeholder="EquiRatings-tekst"
        />
      </Block>

      {/* Video */}
      <Block title="Video">
        {lot.video_url ? (
          <div style={videoWrapStyle}>
            <iframe
              src={lot.video_url}
              title={`Video van ${lot.name}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={videoIframeStyle}
            />
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Video nog niet beschikbaar
            {lot.source_url && (
              <> — origineel op <a href={lot.source_url} target="_blank" rel="noopener noreferrer">{new URL(lot.source_url).hostname}</a></>
            )}
          </p>
        )}
      </Block>

      {/* Optional fields */}
      {lot.usp && <Block title="USP"><p>{lot.usp}</p></Block>}
      {lot.strong_points && <Block title="Sterke punten"><p>{lot.strong_points}</p></Block>}
      {lot.weak_points && <Block title="Aandachtspunten"><p>{lot.weak_points}</p></Block>}

      {/* Geïnteresseerde klanten */}
      {auction && (
        <InterestedClientsField
          lotId={lotId}
          auctionId={lot.auction_id}
          houseId={auction.auction_houses?.id}
        />
      )}

      {/* Mijn notities */}
      <Block title="Mijn notities" key={`notes-${lotId}`}>
        <NoteField lotId={lotId} fieldName="notes_catalog" initialValue={lot.notes_catalog} label="Catalogus" />
        <NoteField lotId={lotId} fieldName="notes_video"   initialValue={lot.notes_video}   label="Video" />
        <NoteField lotId={lotId} fieldName="notes_org"     initialValue={lot.notes_org}     label="Organisatie" />
      </Block>

      {/* Vorig/volgend lot */}
      <nav style={navStyle}>
        <NavLink lot={prev} dir="prev" />
        <small style={{ color: 'var(--text-muted)' }}>
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
      <span style={{ color: 'var(--text-muted)', flex: 1, textAlign: align }}>
        {dir === 'prev' ? `${arrow} Begin` : `Einde ${arrow}`}
      </span>
    )
  }
  const label = `#${lot.number ?? '—'} ${lot.name}`
  return (
    <Link
      to={`/lots/${lot.id}`}
      style={{ flex: 1, textAlign: align, textDecoration: 'none', color: 'var(--text-primary)' }}
    >
      {dir === 'prev' ? `${arrow} ${label}` : `${label} ${arrow}`}
    </Link>
  )
}

function Block({ title, children }) {
  return (
    <div style={blockStyle}>
      <h2 style={blockTitleStyle}>{title}</h2>
      {children}
    </div>
  )
}

const crumbsStyle = {
  fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 var(--space-3) 0',
}
const crumbStyle = { color: 'var(--text-muted)', textDecoration: 'none' }
const missingBannerStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--warning)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-4)',
  marginBottom: 'var(--space-4)',
  fontSize: '0.9em',
  color: 'var(--warning)',
}
const headerRowStyle = {
  display: 'flex', gap: 'var(--space-4)', alignItems: 'center',
  marginBottom: 'var(--space-4)',
}
const thumbBtnStyle = {
  padding: 0, border: 'none', background: 'transparent',
  cursor: 'pointer', flexShrink: 0,
  borderRadius: 'var(--radius-sm)', overflow: 'hidden',
}
const lotTitleStyle = {
  margin: 0, fontSize: '2rem', fontWeight: 600,
  color: 'var(--text-primary)', lineHeight: 1.2,
}
const metaStyle = {
  color: 'var(--text-secondary)', margin: '0.25rem 0 0 0',
}
const blockStyle = {
  marginTop: 'var(--space-5)',
  paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--border-default)',
}
const blockTitleStyle = {
  fontSize: '0.85rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  margin: '0 0 var(--space-3) 0',
}
const videoWrapStyle = {
  position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden',
  borderRadius: 'var(--radius-md)', background: '#000',
}
const videoIframeStyle = {
  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0,
}
const navStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  gap: 'var(--space-4)',
  marginTop: 'var(--space-6)',
  paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--border-default)',
}
