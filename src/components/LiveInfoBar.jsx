import { Link } from 'react-router-dom'

/**
 * Sticky infobar bovenaan de cockpit. Blijft zichtbaar tijdens scrollen
 * en groepeert alles wat permanent in beeld moet:
 *   - ← Naar veiling (uiterst links)
 *   - Veiling-titel
 *   - Lot-navigatie (vorig | dropdown | volgend)
 *   - Lot-meta (lotnummer, naam, leeftijd, min-bedrag, charity-badge)
 *   - Spotters-strip (verhuisd van een aparte rij onder LiveInfoBar)
 *   - Actueel bod (live uit BidTracker via trackerState)
 *   - Sessie-stats (X/N gehamerd, omzet — via CockpitStatusBar inline)
 *
 * Op tablet portrait (≤900px) toont de balk een compactere variant via
 * een CSS-media-query in src/index.css (.live-info-bar__* classes).
 *
 * BELANGRIJK: de bar leest `trackerState` ALLEEN — geen mutatie. De
 * BidTracker-onStateChange-callback (deel 1 + 2A) blijft intact.
 *
 * Props:
 *   lot              actief lot-object (nullable)
 *   prevLot/nextLot  buur-lots voor navigatie-pijlen
 *   onNavigate       callback bij dropdown-/pijlen-keuze
 *   backTo           link voor "← Naar veiling"
 *   collectionTitle  naam van de veiling
 *   stats            React-element met sessie-statistieken
 *   allLots          lijst voor de lot-dropdown
 *   spotters         array van spotter-objecten (NIEUW in 2B)
 *   trackerState     { amount, spotterId, hasBids } uit BidTracker (NIEUW in 2B)
 */
export default function LiveInfoBar({
  lot, prevLot, nextLot, onNavigate, backTo, collectionTitle, stats, allLots,
  spotters = [],
  trackerState = null,
}) {
  const order  = lot?.auction_order ?? lot?.number ?? '—'
  const showCatExtra = lot && lot.auction_order != null && lot.number != null && lot.auction_order !== lot.number
  const name   = lot?.name ?? '—'
  const age    = lot?.year != null
    ? Math.max(0, new Date().getFullYear() - lot.year) + ' jaar'
    : null
  const minBedrag = lot?.reserve_price != null
    ? `€${formatNum(lot.reserve_price)}`
    : (lot?.start_price != null ? `€${formatNum(lot.start_price)}` : null)

  const liveBid = (trackerState?.amount != null && trackerState.amount > 0)
    ? `€${formatNum(trackerState.amount)}`
    : null

  return (
    <div className="live-info-bar" style={barStyle}>
      {/* Rij 1: navigatie + lot-info */}
      <div className="live-info-bar__row" style={rowStyle}>
        {backTo && (
          <Link to={backTo} className="live-info-bar__back" style={backLinkStyle} title="Terug naar de veiling">
            <span aria-hidden>←</span>
            <span className="lib-back-label" style={{ marginLeft: 6 }}>Naar veiling</span>
          </Link>
        )}

        {collectionTitle && (
          <strong className="lib-collection-title" style={collectionTitleStyle}>{collectionTitle}</strong>
        )}

        {onNavigate && lot && (
          <button
            type="button"
            onClick={() => prevLot && onNavigate(prevLot.id)}
            disabled={!prevLot}
            style={navBtnStyle(!!prevLot)}
            title={prevLot ? `← Vorig: #${prevLot.number ?? '—'} ${prevLot.name}` : 'Begin van de lijst'}
            aria-label="Vorig lot"
          >
            ←
          </button>
        )}

        {lot && (
          <div style={lotBlockStyle}>
            {lot.is_charity && (
              <span className="lib-charity" style={charityBadgeStyle}>
                🎁 CHARITY
              </span>
            )}
            <span style={lotnrStyle}>#{order}</span>
            {allLots && allLots.length > 0 && onNavigate ? (
              <select
                value={lot.id}
                onChange={(e) => onNavigate(e.target.value)}
                style={lotSelectStyle}
                aria-label="Spring naar ander lot"
                title="Spring naar ander lot"
              >
                {allLots.map((l) => {
                  const ord = l.auction_order ?? l.number
                  const mark = l.withdrawn ? ' 🚫' : ''
                  return (
                    <option key={l.id} value={l.id}>
                      #{ord ?? '—'} {l.name}{mark}
                    </option>
                  )
                })}
              </select>
            ) : (
              <strong style={nameStyle}>{name}</strong>
            )}
            {showCatExtra && (
              <span className="lib-cat-nr" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                (Cat. nr {lot.number})
              </span>
            )}
            {age && <Pill className="lib-pill-age" label="Leeftijd" value={age} />}
            {minBedrag && <Pill className="lib-pill-min" label="Min" value={minBedrag} />}
          </div>
        )}

        {onNavigate && lot && (
          <button
            type="button"
            onClick={() => nextLot && onNavigate(nextLot.id)}
            disabled={!nextLot}
            style={navBtnStyle(!!nextLot)}
            title={nextLot ? `Volgend: #${nextLot.number ?? '—'} ${nextLot.name} →` : 'Einde van de lijst'}
            aria-label="Volgend lot"
          >
            →
          </button>
        )}
      </div>

      {/* Rij 2: live spotters + actueel bod + sessie-stats */}
      {(spotters.length > 0 || liveBid || stats) && (
        <div className="live-info-bar__row live-info-bar__row--live" style={liveRowStyle}>
          {spotters.length > 0 && (
            <div className="live-info-bar__spotters" style={spottersStripStyle}>
              <span aria-hidden style={{ marginRight: 4 }}>👥</span>
              {spotters.map((s, i) => (
                <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <span style={sepStyle}>·</span>}
                  <span
                    className="lib-spotter-name"
                    title={s.location ? `${s.name} — ${s.location}` : s.name}
                  >
                    {s.name}
                  </span>
                  <span
                    className="lib-spotter-initials"
                    title={s.location ? `${s.name} — ${s.location}` : s.name}
                  >
                    {initials(s.name)}
                  </span>
                </span>
              ))}
            </div>
          )}

          {liveBid && (
            <div className="live-info-bar__bid" style={bidStyle} title="Actueel bod uit de bod-tracker (live)">
              <span style={bidLabelStyle}>BOD</span>
              <span style={bidValueStyle} className="num">{liveBid}</span>
            </div>
          )}

          {stats && <div style={statsWrapStyle}>{stats}</div>}
        </div>
      )}
    </div>
  )
}

function Pill({ label, value, className }) {
  return (
    <span className={className} style={pillStyle}>
      <span style={pillLabelStyle}>{label}</span>
      <span>{value}</span>
    </span>
  )
}

function initials(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/).slice(0, 2)
  return parts.map((w) => w[0]?.toUpperCase() || '').join('') || '?'
}

function formatNum(n) {
  if (n == null) return ''
  return Number(n).toLocaleString('nl-BE', { maximumFractionDigits: 0 })
}

const barStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  background: 'var(--bg-base, #1a1a1a)',
  borderBottom: '1px solid var(--border-default)',
  padding: '8px 12px',
  marginBottom: 'var(--space-3)',
  marginLeft: 'calc(-1 * var(--space-5))',
  marginRight: 'calc(-1 * var(--space-5))',
  paddingLeft: 'var(--space-5)',
  paddingRight: 'var(--space-5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
}

const liveRowStyle = {
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
}

const lotBlockStyle = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem',
  minWidth: 0,
}

const collectionTitleStyle = {
  color: 'var(--text-primary)',
  fontSize: '0.95rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
}

const statsWrapStyle = {
  display: 'inline-flex', alignItems: 'center',
  marginLeft: 'auto',
  color: 'var(--text-secondary)',
  fontSize: '0.85rem',
}

const lotSelectStyle = {
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 8px',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  maxWidth: '420px',
}

const backLinkStyle = {
  flexShrink: 0,
  display: 'inline-flex', alignItems: 'center',
  height: 36, padding: '0 12px',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  textDecoration: 'none',
  fontSize: '0.9em', fontWeight: 600,
}

const charityBadgeStyle = {
  background: 'var(--accent)', color: '#fff',
  fontSize: '0.7em', padding: '2px 8px',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 700, letterSpacing: '0.06em',
}

function navBtnStyle(enabled) {
  return {
    flexShrink: 0,
    minWidth: 36, height: 36,
    padding: '0 10px',
    background: enabled ? 'var(--bg-elevated)' : 'transparent',
    color: enabled ? 'var(--text-primary)' : 'var(--text-muted)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1.1rem',
    fontWeight: 700,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'inherit',
    opacity: enabled ? 1 : 0.5,
  }
}

const lotnrStyle = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
  fontSize: '1rem',
}
const nameStyle = {
  color: 'var(--text-primary)',
  fontSize: '1.1rem',
}
const pillStyle = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 4,
  padding: '2px 8px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
}
const pillLabelStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 600,
}

const spottersStripStyle = {
  display: 'flex', alignItems: 'center',
  gap: 8, flexWrap: 'wrap',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
}
const sepStyle = {
  color: 'var(--text-muted)',
}

const bidStyle = {
  display: 'inline-flex', alignItems: 'baseline', gap: 6,
  padding: '4px 12px',
  background: 'var(--accent)',
  color: 'var(--bg-base)',
  borderRadius: 'var(--radius-sm)',
  fontWeight: 700,
}
const bidLabelStyle = {
  fontSize: '0.65rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.85,
}
const bidValueStyle = {
  fontSize: '1rem',
  fontFamily: 'var(--font-mono)',
}
