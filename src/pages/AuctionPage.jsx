import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { hasMissing, translateMissing } from '../lib/missingInfo'
import LotTypesSelector from '../components/LotTypesSelector'
import BidStepRulesEditor from '../components/BidStepRulesEditor'
import SpottersField from '../components/SpottersField'
import {
  getBreaks, createBreak, updateBreak, deleteBreak,
} from '../lib/breaks'

export default function AuctionPage() {
  const { auctionId } = useParams()
  const [auction, setAuction] = useState(null)
  const [lots, setLots] = useState([])
  const [breaks, setBreaks] = useState([])
  const [status, setStatus] = useState('Laden…')
  const [selectedTypeIds, setSelectedTypeIds] = useState(new Set())
  const [sortMode, setSortMode] = useState('number') // 'number' | 'alphabetical'
  const [breakForm, setBreakForm] = useState(null)   // null | { id?, after_lot_number, ... }
  const [copyFeedback, setCopyFeedback] = useState(null)

  useEffect(() => {
    async function load() {
      const [auctionRes, lotsRes, breaksList] = await Promise.all([
        supabase
          .from('auctions')
          .select('*, auction_houses(id, name)')
          .eq('id', auctionId)
          .single(),
        supabase
          .from('lots')
          .select('id, number, name, discipline, year, gender, studbook, sire, dam, photos, missing_info')
          .eq('auction_id', auctionId)
          .order('number', { nullsFirst: false })
          .order('name'),
        getBreaks(auctionId),
      ])

      if (auctionRes.error) { setStatus(`Fout bij ophalen veiling: ${auctionRes.error.message}`); return }
      if (lotsRes.error)    { setStatus(`Fout bij ophalen lots: ${lotsRes.error.message}`); return }

      setAuction(auctionRes.data)
      setLots(lotsRes.data)
      setBreaks(breaksList)
      setStatus(`${lotsRes.data.length} lots`)
    }
    load()
  }, [auctionId])

  const houseId = auction?.auction_houses?.id
  const houseName = auction?.auction_houses?.name

  // Sorteer + voeg breaks tussen lots in (alleen bij number-sortering).
  // Bij alphabetisch: lots A-Z, breaks worden los onderaan getoond.
  const items = useMemo(() => {
    const sortedLots = [...lots].sort((a, b) => {
      if (sortMode === 'alphabetical') {
        return (a.name ?? '').localeCompare(b.name ?? '', 'nl')
      }
      // number
      if (a.number == null && b.number == null) return (a.name ?? '').localeCompare(b.name ?? '', 'nl')
      if (a.number == null) return 1
      if (b.number == null) return -1
      return a.number - b.number
    })

    if (sortMode === 'alphabetical') {
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
    // bij alfabetisch: alle breaks zijn los
    return breaks
  }, [breaks, lots, sortMode])

  async function reloadBreaks() {
    setBreaks(await getBreaks(auctionId))
  }

  async function handleSaveBreak(draft) {
    try {
      if (draft.id) {
        await updateBreak(draft.id, draft)
      } else {
        await createBreak(auctionId, draft)
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
    if (!auction) return
    const newValue = !auction.online_bidding_enabled
    const { error } = await supabase
      .from('auctions')
      .update({ online_bidding_enabled: newValue })
      .eq('id', auctionId)
    if (error) { alert(`Fout: ${error.message}`); return }
    setAuction((prev) => ({ ...prev, online_bidding_enabled: newValue }))
  }

  async function copySummaryLink() {
    const url = `${window.location.origin}/auctions/${auctionId}/summary`
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
      <p>
        <Link to="/" style={{ color: 'var(--text-muted)' }}>Veilinghuizen</Link>
        {houseId && <>{' › '}<Link to={`/houses/${houseId}`} style={{ color: 'var(--text-muted)' }}>{houseName}</Link></>}
      </p>
      <h1 style={{ color: 'var(--text-primary)' }}>{auction?.name ?? 'Veiling'}</h1>
      <p style={{ color: 'var(--text-secondary)' }}>{status}</p>

      {auction && (
        <div style={actionRowStyle}>
          <Link to={`/cockpit/${auction.id}`} style={primaryBtnStyle}>
            🎬 Cockpit openen
          </Link>
          <Link to={`/auctions/${auction.id}/summary`} style={secondaryBtnStyle}>
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
              checked={!!auction.online_bidding_enabled}
              onChange={toggleOnlineBidding}
              style={{ marginRight: 6 }}
            />
            Online biedingen actief
          </label>
        </div>
      )}

      {auction && (
        <LotTypesSelector
          auctionId={auction.id}
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

      {/* Lijst met lots + ingevoegde breaks */}
      {items.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item) =>
            item.type === 'lot'
              ? <LotRow key={item.key} lot={item.data} />
              : <BreakRow
                  key={item.key}
                  br={item.data}
                  onEdit={() => setBreakForm({ ...item.data })}
                  onDelete={() => handleDeleteBreak(item.data.id)}
                />
          )}
        </ul>
      )}

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
      {auction && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <BidStepRulesEditor
            auctionId={auction.id}
            selectedTypeIds={selectedTypeIds}
          />
          <SpottersField auctionId={auction.id} />
        </div>
      )}
    </section>
  )
}

/* ---------- Lot-rij ---------- */

function LotRow({ lot }) {
  return (
    <li style={{ borderBottom: '1px solid var(--border-default)' }}>
      <Link
        to={`/lots/${lot.id}`}
        style={{
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
            {[lot.discipline, lot.year, lot.gender, lot.studbook].filter(Boolean).join(' • ')}
          </div>
          {(lot.sire || lot.dam) && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85em', fontStyle: 'italic' }}>
              {lot.sire ?? '?'} × {lot.dam ?? '?'}
            </div>
          )}
        </div>
      </Link>
    </li>
  )
}

/* ---------- Pauze-rij ---------- */

function BreakRow({ br, onEdit, onDelete }) {
  const label = br.after_lot_number != null ? `${br.after_lot_number} BIS` : '— BIS'
  return (
    <li style={breakRowStyle}>
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
