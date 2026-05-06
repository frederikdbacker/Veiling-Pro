import { useEffect, useMemo, useState } from 'react'
import StarRating from '../components/StarRating'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { hasMissing, translateMissing } from '../lib/missingInfo'
import Breadcrumbs from '../components/Breadcrumbs'
import LotTypesSelector from '../components/LotTypesSelector'
import BidStepRulesEditor from '../components/BidStepRulesEditor'
import SpottersField from '../components/SpottersField'
import {
  getBreaks, createBreak, updateBreak, deleteBreak,
} from '../lib/breaks'

export default function CollectionPage() {
  const { collectionId } = useParams()
  const [collection, setCollection] = useState(null)
  const [lots, setLots] = useState([])
  const [breaks, setBreaks] = useState([])
  const [status, setStatus] = useState('Laden…')
  const [selectedTypeIds, setSelectedTypeIds] = useState(new Set())
  const [sortMode, setSortMode] = useState('number') // 'number' | 'alphabetical' | 'rating'
  const [hideRatings, setHideRatings] = useState(false)
  const [breakForm, setBreakForm] = useState(null)   // null | { id?, after_lot_number, ... }
  const [copyFeedback, setCopyFeedback] = useState(null)

  useEffect(() => {
    async function load() {
      const [collectionRes, lotsRes, breaksList] = await Promise.all([
        supabase
          .from('collections')
          .select('*, auction_houses(id, name)')
          .eq('id', collectionId)
          .single(),
        supabase
          .from('lots')
          .select('id, number, name, discipline, year, gender, studbook, sire, dam, photos, missing_info, rating, stallion_approved')
          .eq('collection_id', collectionId)
          .order('number', { nullsFirst: false })
          .order('name'),
        getBreaks(collectionId),
      ])

      if (collectionRes.error) { setStatus(`Fout bij ophalen collectie: ${collectionRes.error.message}`); return }
      if (lotsRes.error)    { setStatus(`Fout bij ophalen lots: ${lotsRes.error.message}`); return }

      setCollection(collectionRes.data)
      setLots(lotsRes.data)
      setBreaks(breaksList)
      setStatus(`${lotsRes.data.length} lots`)
    }
    load()
  }, [collectionId])

  const houseId = collection?.auction_houses?.id
  const houseName = collection?.auction_houses?.name

  // Sorteer + voeg breaks tussen lots in (alleen bij number-sortering).
  // Bij alphabetisch of rating: lots gesorteerd, breaks worden los onderaan getoond.
  const items = useMemo(() => {
    const sortedLots = [...lots].sort((a, b) => {
      if (sortMode === 'alphabetical') {
        return (a.name ?? '').localeCompare(b.name ?? '', 'nl')
      }
      if (sortMode === 'rating') {
        // Hoge rating eerst, null/0 onderaan; bij gelijke rating op naam
        const ra = a.rating ?? 0
        const rb = b.rating ?? 0
        if (ra !== rb) return rb - ra
        return (a.name ?? '').localeCompare(b.name ?? '', 'nl')
      }
      // number
      if (a.number == null && b.number == null) return (a.name ?? '').localeCompare(b.name ?? '', 'nl')
      if (a.number == null) return 1
      if (b.number == null) return -1
      return a.number - b.number
    })

    if (sortMode === 'alphabetical' || sortMode === 'rating') {
      return sortedLots.map((l) => ({ type: 'lot', key: l.id, data: l }))
    }

    // sortMode === 'number': breaks ingevoegd op after_lot_number
    const breaksByPos = new Map()
    for (const br of breaks) {
      const k = br.after_lot_number
      if (k == null) continue
      if (!breaksByPos.has(k)) breaksByPos.set(k, [])
      breaksByPos.get(k).push(br)
    }
    const result = []
    for (const lot of sortedLots) {
      result.push({ type: 'lot', key: lot.id, data: lot })
      const brs = breaksByPos.get(lot.number)
      if (brs) for (const b of brs) result.push({ type: 'break', key: b.id, data: b })
    }
    return result
  }, [lots, breaks, sortMode])

  const orphanBreaks = useMemo(() => {
    if (sortMode === 'number') {
      // Breaks met after_lot_number die niet matcht een bestaand lot
      const lotNumbers = new Set(lots.map((l) => l.number).filter((n) => n != null))
      return breaks.filter((b) =>
        b.after_lot_number == null || !lotNumbers.has(b.after_lot_number)
      )
    }
    // bij alfabetisch of rating: alle breaks zijn los
    return breaks
  }, [breaks, lots, sortMode])

  function handleRatingChanged(lotId, newRating) {
    setLots((prev) => prev.map((l) => l.id === lotId ? { ...l, rating: newRating } : l))
  }

  async function handleClearAllRatings() {
    const rated = lots.filter((l) => l.rating != null).length
    if (rated === 0) { alert('Er zijn geen ratings om te wissen.'); return }
    if (!confirm(`Alle ratings wissen voor deze veiling? ${rated} lot${rated > 1 ? 's' : ''} verliezen hun sterren-waarde.`)) return
    const { error } = await supabase
      .from('lots')
      .update({ rating: null })
      .eq('collection_id', collectionId)
    if (error) { alert(`Wissen mislukt: ${error.message}`); return }
    setLots((prev) => prev.map((l) => ({ ...l, rating: null })))
  }

  async function reloadBreaks() {
    setBreaks(await getBreaks(collectionId))
  }

  async function handleSaveBreak(draft) {
    try {
      if (draft.id) {
        await updateBreak(draft.id, draft)
      } else {
        await createBreak(collectionId, draft)
      }
      setBreakForm(null)
      await reloadBreaks()
    } catch (e) {
      alert(`Fout: ${e.message}`)
    }
  }

  async function handleDeleteBreak(id) {
    if (!window.confirm('Pauze verwijderen?')) return
    try {
      await deleteBreak(id)
      await reloadBreaks()
    } catch (e) { alert(`Fout: ${e.message}`) }
  }

  async function toggleOnlineBidding() {
    if (!collection) return
    const newValue = !collection.online_bidding_enabled
    const { error } = await supabase
      .from('collections')
      .update({ online_bidding_enabled: newValue })
      .eq('id', collectionId)
    if (error) { alert(`Fout: ${error.message}`); return }
    setCollection((prev) => ({ ...prev, online_bidding_enabled: newValue }))
  }

  // Drag-and-drop voor pauzes — bepaalt nieuwe after_lot_number
  // op basis van het lot direct boven de gedropte break in de
  // herordende lijst. Werkt enkel bij sortMode='number'.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex((i) => i.key === active.id)
    const newIdx = items.findIndex((i) => i.key === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const dragged = items[oldIdx]
    if (dragged.type !== 'break') return

    const newOrder = arrayMove(items, oldIdx, newIdx)

    // Vind het lot direct boven de gedropte break in de nieuwe volgorde
    let afterLotNumber = null
    for (let i = newIdx; i >= 0; i--) {
      if (newOrder[i].type === 'lot') {
        afterLotNumber = newOrder[i].data.number
        break
      }
    }

    try {
      await updateBreak(dragged.data.id, { after_lot_number: afterLotNumber })
      await reloadBreaks()
    } catch (e) {
      alert(`Fout bij verplaatsen: ${e.message}`)
    }
  }

  async function copySummaryLink() {
    const url = `${window.location.origin}/collections/${collectionId}/summary`
    try {
      await navigator.clipboard.writeText(url)
      setCopyFeedback('✓ Link gekopieerd')
    } catch (e) {
      setCopyFeedback(`Fout: ${e.message}`)
    }
    setTimeout(() => setCopyFeedback(null), 2500)
  }

  return (
    <section>
      <Breadcrumbs trail={[
        { label: 'Veilinghuizen', to: '/' },
        houseId && { label: houseName, to: `/houses/${houseId}` },
        { label: collection?.name ?? 'Collectie' },
      ].filter(Boolean)} />
      <h1 style={{ color: 'var(--text-primary)' }}>{collection?.name ?? 'Collectie'}</h1>
      <p style={{ color: 'var(--text-secondary)' }}>{status}</p>

      {collection && (
        <div style={actionRowStyle}>
          <Link to={`/cockpit/${collection.id}`} style={primaryBtnStyle}>
            🎬 Cockpit openen
          </Link>
          <Link to={`/collections/${collection.id}/summary`} style={secondaryBtnStyle}>
            📊 Overzicht
          </Link>
          <button onClick={copySummaryLink} style={secondaryBtnStyle} title="Kopieer overzicht-link">
            📋 Link kopiëren
          </button>
          {copyFeedback && (
            <span style={{ color: 'var(--success)', fontSize: '0.9em', marginLeft: 8 }}>
              {copyFeedback}
            </span>
          )}
          <label style={onlineToggleLabelStyle}>
            <input
              type="checkbox"
              checked={!!collection.online_bidding_enabled}
              onChange={toggleOnlineBidding}
              style={{ marginRight: 6 }}
            />
            Online biedingen actief
          </label>
        </div>
      )}

      {collection && (
        <LotTypesSelector
          collectionId={collection.id}
          onChange={setSelectedTypeIds}
        />
      )}

      {/* Sorteer + pauze-knoppen boven de lijst */}
      {lots.length > 0 && (
        <div style={toolbarStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>Sorteer:</span>
            <SortToggleButton
              active={sortMode === 'number'}
              onClick={() => setSortMode('number')}
            >
              # Lotnummer
            </SortToggleButton>
            <SortToggleButton
              active={sortMode === 'alphabetical'}
              onClick={() => setSortMode('alphabetical')}
            >
              A-Z naam
            </SortToggleButton>
            <SortToggleButton
              active={sortMode === 'rating'}
              onClick={() => setSortMode('rating')}
            >
              ★ Rating
            </SortToggleButton>
            <button
              type="button"
              onClick={() => setHideRatings((v) => !v)}
              title={hideRatings ? 'Toon ratings' : 'Verberg ratings'}
              style={ratingActionBtnStyle}
            >
              {hideRatings ? '👁 toon ratings' : '🙈 verberg ratings'}
            </button>
            <button
              type="button"
              onClick={handleClearAllRatings}
              title="Alle ratings van deze veiling wissen"
              style={ratingActionBtnStyle}
            >
              ✕ wis alle ratings
            </button>
          </div>
          <button
            onClick={() => setBreakForm({
              after_lot_number: null, title: 'Pauze',
              description: '', duration_minutes: 15,
            })}
            style={addBreakBtnStyle}
          >
            ⏸ + Pauze toevoegen
          </button>
        </div>
      )}

      {/* Inline pauze-form (toevoegen of bewerken) */}
      {breakForm && (
        <BreakForm
          draft={breakForm}
          lots={lots}
          onChange={setBreakForm}
          onSave={() => handleSaveBreak(breakForm)}
          onCancel={() => setBreakForm(null)}
        />
      )}

      {/* Lijst met lots + ingevoegde breaks. Bij Lotnummer-sortering
          zijn breaks sleepbaar tussen lots; lots zelf zijn niet
          sleepbaar. Bij A-Z wordt drag uitgeschakeld. */}
      {items.length > 0 && sortMode === 'number' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.key)}
            strategy={verticalListSortingStrategy}
          >
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {items.map((item) =>
                item.type === 'lot'
                  ? <SortableLotRow key={item.key} item={item} onRatingChanged={handleRatingChanged} hideRating={hideRatings} />
                  : <SortableBreakRow
                      key={item.key}
                      item={item}
                      onEdit={() => setBreakForm({ ...item.data })}
                      onDelete={() => handleDeleteBreak(item.data.id)}
                    />
              )}
            </ul>
          </SortableContext>
        </DndContext>
      ) : items.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item) => <LotRow key={item.key} lot={item.data} onRatingChanged={handleRatingChanged} hideRating={hideRatings} />)}
        </ul>
      ) : null}

      {/* Bij alfabetisch of bij breaks zonder geldige positie: aparte sectie */}
      {orphanBreaks.length > 0 && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <h3 style={subHeadingStyle}>
            {sortMode === 'alphabetical' ? 'Pauzes' : 'Pauzes zonder positie'}
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {orphanBreaks.map((br) => (
              <BreakRow
                key={br.id}
                br={br}
                onEdit={() => setBreakForm({ ...br })}
                onDelete={() => handleDeleteBreak(br.id)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Onderste blokken */}
      {collection && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <BidStepRulesEditor
            collectionId={collection.id}
            selectedTypeIds={selectedTypeIds}
          />
          <SpottersField collectionId={collection.id} />
        </div>
      )}
    </section>
  )
}

/* ---------- Sortable wrappers ---------- */

function SortableLotRow({ item, onRatingChanged, hideRating }) {
  // Lots zijn niet sleepbaar maar wél drop-target zodat breaks tussen
  // lots gedropt kunnen worden. disabled=true op useSortable.
  const { setNodeRef } = useSortable({ id: item.key, disabled: true })
  return (
    <div ref={setNodeRef}>
      <LotRow lot={item.data} onRatingChanged={onRatingChanged} hideRating={hideRating} />
    </div>
  )
}

function SortableBreakRow({ item, onEdit, onDelete }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: item.key })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <BreakRow
        br={item.data}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

/* ---------- Lot-rij ---------- */

function LotRow({ lot, onRatingChanged, hideRating }) {
  return (
    <li style={{
      borderBottom: '1px solid var(--border-default)',
      display: 'flex', alignItems: 'center', gap: '0.5rem', paddingRight: '0.5rem',
    }}>
      <Link
        to={`/lots/${lot.id}`}
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '0.75rem 0',
          textDecoration: 'none', color: 'var(--text-primary)',
        }}
      >
        <Thumb src={lot.photos?.[0]} alt={lot.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--text-muted)', marginRight: '0.5em' }}>
              #{lot.number ?? '—'}
            </span>
            {lot.name}
            {hasMissing(lot.missing_info) && (
              <span
                title={`Ontbreekt: ${translateMissing(lot.missing_info).join(', ')}`}
                style={{
                  marginLeft: '0.5em', color: 'var(--warning)',
                  fontWeight: 'normal', fontSize: '0.85em',
                }}
              >
                ⚠ {lot.missing_info.length}
              </span>
            )}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85em', marginTop: '0.15rem' }}>
            {[
              lot.discipline,
              lot.year,
              lot.gender + (lot.stallion_approved ? ' ggk' : ''),
              lot.studbook,
            ].filter(Boolean).join(' • ')}
          </div>
          {(lot.sire || lot.dam) && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85em', fontStyle: 'italic' }}>
              {lot.sire ?? '?'} × {lot.dam ?? '?'}
            </div>
          )}
        </div>
      </Link>
      {!hideRating && (
        <StarRating
          lotId={lot.id}
          initialValue={lot.rating}
          size="0.85em"
          onSaved={(rating) => onRatingChanged?.(lot.id, rating)}
        />
      )}
    </li>
  )
}

/* ---------- Pauze-rij ---------- */

function BreakRow({ br, onEdit, onDelete, dragHandleProps }) {
  const label = br.after_lot_number != null ? `${br.after_lot_number} BIS` : '— BIS'
  return (
    <li style={breakRowStyle}>
      {dragHandleProps && (
        <button
          {...dragHandleProps}
          style={dragHandleStyle}
          title="Versleep om te verplaatsen"
          aria-label="Versleep pauze"
        >
          ⠿
        </button>
      )}
      <div style={breakIconStyle}>⏸</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={breakLabelStyle}>{label}</span>
          <strong style={{ color: 'var(--text-primary)' }}>{br.title || 'Pauze'}</strong>
          {br.duration_minutes != null && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>
              · {br.duration_minutes} min
            </span>
          )}
        </div>
        {br.description && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85em', marginTop: 2 }}>
            {br.description}
          </div>
        )}
      </div>
      <button onClick={onEdit} style={smallBtnStyle} title="Bewerk pauze">✏</button>
      <button onClick={onDelete} style={smallBtnStyle} title="Verwijder pauze">✕</button>
    </li>
  )
}

/* ---------- Pauze-formulier ---------- */

function BreakForm({ draft, lots, onChange, onSave, onCancel }) {
  function set(field, value) { onChange({ ...draft, [field]: value }) }

  // Sorteer lots op number voor de dropdown (lots zonder nummer onderaan)
  const lotsWithNumber = lots
    .filter((l) => l.number != null)
    .sort((a, b) => a.number - b.number)

  return (
    <div style={breakFormStyle}>
      <h3 style={{ ...subHeadingStyle, marginTop: 0 }}>
        {draft.id ? 'Pauze bewerken' : 'Nieuwe pauze'}
      </h3>
      <div style={fieldRowStyle}>
        <label style={fieldLabelStyle}>Na lot</label>
        <select
          value={draft.after_lot_number ?? ''}
          onChange={(e) => set('after_lot_number', e.target.value === '' ? null : Number(e.target.value))}
          style={selectStyle}
        >
          <option value="">— kies —</option>
          {lotsWithNumber.map((l) => (
            <option key={l.id} value={l.number}>
              #{l.number} {l.name}
            </option>
          ))}
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
          → label: <strong>{draft.after_lot_number != null ? `${draft.after_lot_number} BIS` : '—'}</strong>
        </span>
      </div>
      <div style={fieldRowStyle}>
        <label style={fieldLabelStyle}>Titel</label>
        <input
          type="text" value={draft.title ?? ''}
          onChange={(e) => set('title', e.target.value)}
          placeholder="bv. Pauze, Tussenklap, Welkomstwoord"
          style={inputStyle}
        />
      </div>
      <div style={fieldRowStyle}>
        <label style={fieldLabelStyle}>Duur (min)</label>
        <input
          type="number" min="0" step="5"
          value={draft.duration_minutes ?? ''}
          onChange={(e) => set('duration_minutes', e.target.value === '' ? null : Number(e.target.value))}
          placeholder="bv. 15"
          style={{ ...inputStyle, width: '6em', flex: 'initial' }}
        />
      </div>
      <div style={fieldRowStyle}>
        <label style={fieldLabelStyle}>Info</label>
        <input
          type="text" value={draft.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          placeholder="optioneel — bv. drankje, presentatie van trofee, etc."
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-3)' }}>
        <button onClick={onCancel} style={cancelBtnStyle}>Annuleer</button>
        <button onClick={onSave} style={saveBtnStyle}>
          {draft.id ? 'Wijzigingen bewaren' : 'Pauze toevoegen'}
        </button>
      </div>
    </div>
  )
}

function SortToggleButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.35rem 0.75rem',
        fontSize: '0.85em',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--bg-base)' : 'var(--text-primary)',
        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-default)'),
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: active ? 700 : 400,
      }}
    >
      {children}
    </button>
  )
}

function Thumb({ src, alt }) {
  const size = 72
  if (!src) {
    return (
      <div
        style={{
          width: size, height: size, flexShrink: 0,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: '0.7em',
        }}
      >
        geen foto
      </div>
    )
  }
  return (
    <img
      src={src} alt={alt} width={size} height={size} loading="lazy"
      style={{
        flexShrink: 0, objectFit: 'cover',
        borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)',
      }}
    />
  )
}

const actionRowStyle = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
  marginBottom: 'var(--space-4)',
}
const primaryBtnStyle = {
  display: 'inline-block', padding: '0.4rem 0.85rem',
  background: 'var(--accent)', color: 'var(--bg-base)',
  borderRadius: 'var(--radius-sm)',
  textDecoration: 'none', fontSize: '0.9em', fontWeight: 700,
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
const secondaryBtnStyle = {
  display: 'inline-block', padding: '0.4rem 0.85rem',
  background: 'transparent', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  textDecoration: 'none', fontSize: '0.9em', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}
const onlineToggleLabelStyle = {
  marginLeft: 'auto',
  display: 'inline-flex', alignItems: 'center',
  padding: '0.4rem 0.85rem',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: '0.9em',
  cursor: 'pointer',
  userSelect: 'none',
}
const toolbarStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  flexWrap: 'wrap', gap: 'var(--space-3)',
  padding: 'var(--space-3) 0',
  marginBottom: 'var(--space-2)',
  borderTop: '1px solid var(--border-default)',
  borderBottom: '1px solid var(--border-default)',
}
const addBreakBtnStyle = {
  padding: '0.4rem 0.85rem',
  background: 'transparent',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
  fontSize: '0.9em',
}
const ratingActionBtnStyle = {
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.85em',
  cursor: 'pointer',
  marginLeft: 8,
}
const breakRowStyle = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: 'var(--space-3) 0',
  borderBottom: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  paddingLeft: 'var(--space-3)',
  paddingRight: 'var(--space-3)',
  marginLeft: '-var(--space-3)',
}
const breakIconStyle = {
  width: 36, height: 36, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-full)',
  color: 'var(--accent)',
  fontSize: '1em',
}
const breakLabelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85em',
  letterSpacing: '0.05em',
  color: 'var(--accent)',
  fontWeight: 700,
  padding: '2px 8px',
  border: '1px solid var(--accent-muted)',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
}
const smallBtnStyle = {
  padding: '0.25rem 0.55rem',
  background: 'transparent',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontSize: '0.95em',
  flexShrink: 0,
}
const dragHandleStyle = {
  padding: '0.25rem 0.5rem',
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'grab',
  fontSize: '0.95em',
  flexShrink: 0,
  touchAction: 'none', // belangrijk voor mobile drag
}
const breakFormStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4)',
  margin: 'var(--space-3) 0',
}
const subHeadingStyle = {
  fontSize: '0.85rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  margin: 'var(--space-3) 0',
}
const fieldRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  marginBottom: 6, flexWrap: 'wrap',
}
const fieldLabelStyle = {
  width: '7em', color: 'var(--text-secondary)',
  fontSize: '0.9em', flexShrink: 0,
}
const inputStyle = {
  flex: 1, minWidth: 0,
  padding: '0.4rem 0.5rem', fontSize: '0.95em',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit', boxSizing: 'border-box',
}
const selectStyle = {
  ...inputStyle, flex: 'initial', minWidth: '14em',
}
const cancelBtnStyle = {
  padding: '0.45rem 0.85rem',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
}
const saveBtnStyle = {
  padding: '0.45rem 0.85rem',
  background: 'var(--accent)', color: 'var(--bg-base)',
  border: 'none', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit',
}
