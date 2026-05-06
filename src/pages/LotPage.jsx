import { Fragment, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NoteField from '../components/NoteField'
import RichNoteField from '../components/RichNoteField'
import AutoSaveNumber from '../components/AutoSaveNumber'
import LotTypeDropdown from '../components/LotTypeDropdown'
import StarRating from '../components/StarRating'
import StallionApprovalField from '../components/StallionApprovalField'
import AutoSaveUrl from '../components/AutoSaveUrl'
import InterestedClientsField from '../components/InterestedClientsField'
import PedigreeTree from '../components/PedigreeTree'
import EditableLongText from '../components/EditableLongText'
import Modal from '../components/Modal'
import { hasMissing, translateMissing } from '../lib/missingInfo'
import Breadcrumbs from '../components/Breadcrumbs'

export default function LotPage() {
  const { lotId } = useParams()
  const navigate = useNavigate()
  const [lot, setLot] = useState(null)
  const [collection, setCollection] = useState(null)
  const [siblings, setSiblings] = useState([])
  const [status, setStatus] = useState('Laden…')
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [activePhoto, setActivePhoto] = useState(0)

  useEffect(() => {
    setLot(null)
    setCollection(null)
    setSiblings([])
    setActivePhoto(0)
    setPhotoModalOpen(false)
    setStatus('Laden…')

    async function load() {
      const { data, error } = await supabase
        .from('lots')
        .select('*, collections!collection_id(id, name, auction_houses(id, name))')
        .eq('id', lotId)
        .single()

      if (error) {
        setStatus(`Fout bij ophalen lot: ${error.message}`)
        return
      }

      const sibsRes = await supabase
        .from('lots')
        .select('id, number, name')
        .eq('collection_id', data.collection_id)
        .order('number', { nullsFirst: false })
        .order('name')

      setLot(data)
      setCollection(data.collections)
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
  const houseId = collection?.auction_houses?.id
  const houseName = collection?.auction_houses?.name
  const yearWithAge = lot.year
    ? `${lot.year} / ${Math.max(0, new Date().getFullYear() - lot.year)} jaar`
    : null
  const isStallion = (lot.gender ?? '').toLowerCase() === 'hengst'

  const metaPieces = []
  if (lot.discipline) metaPieces.push(<span key="d">{lot.discipline}</span>)
  if (yearWithAge)    metaPieces.push(<span key="y">{yearWithAge}</span>)
  if (lot.gender) {
    metaPieces.push(
      <span key="g" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {lot.gender}
        {isStallion && (
          <StallionApprovalField
            lotId={lotId}
            currentApproved={lot.stallion_approved}
            currentStudbooks={lot.approved_studbooks}
            onSaved={(patch) => setLot((prev) => ({ ...prev, ...patch }))}
            inline
          />
        )}
      </span>
    )
  }
  if (lot.studbook) metaPieces.push(<span key="s">{lot.studbook}</span>)
  if (lot.size)     metaPieces.push(<span key="sz">{lot.size}</span>)

  return (
    <section>
      {/* Breadcrumb */}
      <Breadcrumbs trail={[
        { label: 'Veilinghuizen', to: '/' },
        houseId   && { label: houseName,       to: `/houses/${houseId}` },
        collection && { label: collection.name, to: `/collections/${collection.id}` },
        { label: lot.name },
      ].filter(Boolean)} />

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
          <div style={titleNavRowStyle}>
            <button
              type="button"
              disabled={!prev}
              onClick={() => prev && navigate(`/lots/${prev.id}`)}
              title={prev ? `Vorig: #${prev.number ?? '—'} ${prev.name}` : 'Geen vorig lot'}
              style={{ ...navBtnStyle, opacity: prev ? 1 : 0.4, cursor: prev ? 'pointer' : 'not-allowed' }}
              aria-label="Vorig lot"
            >
              ←
            </button>
            <select
              value={lotId}
              onChange={(e) => navigate(`/lots/${e.target.value}`)}
              style={titleSelectStyle}
              aria-label="Spring naar ander lot"
            >
              {siblings.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.number ?? '—'} — {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && navigate(`/lots/${next.id}`)}
              title={next ? `Volgend: #${next.number ?? '—'} ${next.name}` : 'Geen volgend lot'}
              style={{ ...navBtnStyle, opacity: next ? 1 : 0.4, cursor: next ? 'pointer' : 'not-allowed' }}
              aria-label="Volgend lot"
            >
              →
            </button>
          </div>
          {metaPieces.length > 0 && (
            <div style={{ ...metaStyle, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 0.4em' }}>
              {metaPieces.map((piece, i) => (
                <Fragment key={i}>
                  {i > 0 && <span style={{ color: 'var(--text-muted)' }}>·</span>}
                  {piece}
                </Fragment>
              ))}
            </div>
          )}
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
            collectionId={lot.collection_id}
            currentTypeId={lot.lot_type_id}
            currentAuto={lot.lot_type_auto}
            onSaved={(typeId) => setLot((prev) => ({ ...prev, lot_type_id: typeId, lot_type_auto: false }))}
          />
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Rating</label>
            <div style={{ display: 'flex', alignItems: 'center', minHeight: '34px' }}>
              <StarRating
                lotId={lotId}
                initialValue={lot.rating}
                size="1.05em"
                onSaved={(rating) => setLot((prev) => ({ ...prev, rating }))}
              />
            </div>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Charity</label>
            <div style={{ display: 'flex', alignItems: 'center', minHeight: '34px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!lot.is_charity}
                  onChange={async (e) => {
                    const next = e.target.checked
                    setLot((prev) => ({ ...prev, is_charity: next }))
                    const { error } = await supabase
                      .from('lots')
                      .update({ is_charity: next })
                      .eq('id', lotId)
                    if (error) {
                      alert(`Charity-flag opslaan mislukt: ${error.message}`)
                      setLot((prev) => ({ ...prev, is_charity: !next }))
                    }
                  }}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>
                  🎁 Weggeef-lot — telt niet mee in omzetstatistieken
                </span>
              </label>
            </div>
          </div>
        </div>
        {/* Verkocht-resultaat — getoond zodra de cockpit een hamer heeft geslagen */}
        {lot.sold === true && lot.sale_price != null && (
          <div style={soldStyle}>
            ✓ Verkocht{lot.sale_channel ? ` ${lot.sale_channel === 'zaal' ? 'in zaal' : 'online'}` : ''}{' '}
            voor <strong>€{Number(lot.sale_price).toLocaleString('nl-BE')}</strong>
          </div>
        )}
        {lot.sold === false && (
          <div style={notSoldStyle}>
            ⊘ Niet verkocht{lot.sale_price != null ? ` (hoogste bod €${Number(lot.sale_price).toLocaleString('nl-BE')})` : ''}
          </div>
        )}
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
            initialValue={lot.url_extra} label="Auction page"
            placeholder="https://..."
            compact
            onSaved={(value) => setLot((prev) => ({ ...prev, url_extra: value }))}
          />
        </div>
      </Block>

      {/* Beschrijving — catalogustekst + EquiRatings samengevoegd in één blok.
          Allebei bewerkbaar via ✏ wanneer de scrape niets vond. */}
      <Block title="Beschrijving">
        <EditableLongText
          key={`cat-${lotId}`}
          id={lotId}
          fieldName="catalog_text"
          initialValue={lot.catalog_text}
          placeholder="catalogustekst"
        />
        <div style={{ height: 'var(--space-4)' }} />
        <EditableLongText
          key={`equi-${lotId}`}
          id={lotId}
          fieldName="equiratings_text"
          initialValue={lot.equiratings_text}
          placeholder="EquiRatings-tekst"
        />
      </Block>

{/* Optional fields */}
      {lot.usp && <Block title="USP"><p>{lot.usp}</p></Block>}
      {lot.strong_points && <Block title="Sterke punten"><p>{lot.strong_points}</p></Block>}
      {lot.weak_points && <Block title="Aandachtspunten"><p>{lot.weak_points}</p></Block>}

      {/* Geïnteresseerde klanten */}
      {collection && (
        <InterestedClientsField
          lotId={lotId}
          collectionId={lot.collection_id}
          houseId={collection.auction_houses?.id}
        />
      )}

      {/* Mijn notities */}
      <Block title="Mijn notities" key={`notes-${lotId}`}>
        <RichNoteField key={`fam-${lotId}`} lotId={lotId} fieldName="notes_familie"        initialValue={lot.notes_familie}        label="Familie"        compact />
        <RichNoteField key={`res-${lotId}`} lotId={lotId} fieldName="notes_resultaten"     initialValue={lot.notes_resultaten}     label="Resultaten"     compact />
        <RichNoteField key={`ken-${lotId}`} lotId={lotId} fieldName="notes_kenmerken"      initialValue={lot.notes_kenmerken}      label="Kenmerken"      compact />
        <RichNoteField key={`org-${lotId}`} lotId={lotId} fieldName="notes_organisatie"    initialValue={lot.notes_organisatie}    label="Organisatie"    compact />
        <RichNoteField key={`biz-${lotId}`} lotId={lotId} fieldName="notes_bijzonderheden" initialValue={lot.notes_bijzonderheden} label="Bijzonderheden" compact />
      </Block>

      {/* Verouderde notities — alleen tonen zolang notes_catalog of notes_video nog data bevatten.
          Read-only zodat Frederik content kan kopiëren naar de nieuwe rubrieken; ✕ verwijdert. */}
      {(lot.notes_catalog || lot.notes_video) && (
        <Block title="Verouderde notities (overzetten en verwijderen)">
          {lot.notes_catalog && (
            <LegacyNoteRow
              lotId={lotId}
              fieldName="notes_catalog"
              value={lot.notes_catalog}
              label="Catalogus"
              onCleared={() => setLot((prev) => ({ ...prev, notes_catalog: null }))}
            />
          )}
          {lot.notes_video && (
            <LegacyNoteRow
              lotId={lotId}
              fieldName="notes_video"
              value={lot.notes_video}
              label="Video"
              onCleared={() => setLot((prev) => ({ ...prev, notes_video: null }))}
            />
          )}
        </Block>
      )}

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

function LegacyNoteRow({ lotId, fieldName, value, label, onCleared }) {
  const [clearing, setClearing] = useState(false)

  async function handleClear() {
    if (!confirm(`"${label}"-notitie verwijderen? Backup-CSV is nog beschikbaar als je iets terug wil.`)) return
    setClearing(true)
    const { error } = await supabase.from('lots').update({ [fieldName]: null }).eq('id', lotId)
    setClearing(false)
    if (error) { alert(error.message); return }
    onCleared()
  }

  return (
    <div style={legacyRowStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ color: 'var(--text-muted)', fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </strong>
        <button
          type="button"
          onClick={handleClear}
          disabled={clearing}
          title="Verwijderen na overzetten"
          style={legacyClearBtnStyle}
        >
          {clearing ? '…' : '✕ verwijder'}
        </button>
      </div>
      <pre style={legacyTextStyle}>{value}</pre>
    </div>
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
  flexWrap: 'wrap',
  marginBottom: 'var(--space-4)',
}
const titleNavRowStyle = {
  display: 'flex', gap: 'var(--space-3)', alignItems: 'center',
}
const navBtnStyle = {
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '1.1rem',
  fontWeight: 600,
  height: '36px',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}
const titleSelectStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
  fontSize: '1.1rem',
  fontWeight: 600,
  padding: '0 var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  maxWidth: '320px',
  fontFamily: 'inherit',
  height: '36px',
  boxSizing: 'border-box',
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
const soldStyle = {
  marginTop: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--success)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--success)',
  fontSize: '0.95em',
  fontWeight: 600,
}
const notSoldStyle = {
  marginTop: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--warning)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--warning)',
  fontSize: '0.95em',
  fontWeight: 600,
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
const legacyRowStyle = {
  background: 'var(--bg-elevated)',
  border: '1px dashed var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-3)',
  marginBottom: 'var(--space-3)',
  opacity: 0.85,
}
const legacyTextStyle = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  color: 'var(--text-secondary)',
  fontFamily: 'inherit',
  fontSize: '0.95em',
  lineHeight: 1.4,
}
const legacyClearBtnStyle = {
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-muted)',
  padding: '2px 8px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.85em',
  cursor: 'pointer',
}
const navStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  gap: 'var(--space-4)',
  marginTop: 'var(--space-6)',
  paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--border-default)',
}
