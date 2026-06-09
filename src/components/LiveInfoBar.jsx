import { Link } from 'react-router-dom'

/**
 * Sticky infobar bovenaan de cockpit (#24 uit POST_ALOGA_ROADMAP.md).
 * Blijft zichtbaar tijdens scrollen en toont de cruciale lot-info
 * voor tijdens het veilen: lotnummer, naam, leeftijd, minimumbedrag,
 * vader, moedersvader.
 *
 * Eén balk — sessie-statistieken (omzet, gem. duur, eindetijd) horen
 * hier expliciet NIET bij; die zitten in de gewone CockpitStatusBar.
 *
 * Props:
 *   lot   het actieve lot-object (nullable — toont placeholder dan)
 */
export default function LiveInfoBar({ lot, prevLot, nextLot, onNavigate, backTo }) {
  if (!lot) return null

  const order  = lot.auction_order ?? lot.number ?? '—'
  const showCatExtra = lot.auction_order != null && lot.number != null && lot.auction_order !== lot.number
  const name   = lot.name ?? '—'
  const age    = lot.year != null
    ? Math.max(0, new Date().getFullYear() - lot.year) + ' jaar'
    : null
  const minBedrag = lot.reserve_price != null
    ? `€${formatNum(lot.reserve_price)}`
    : (lot.start_price != null ? `€${formatNum(lot.start_price)}` : null)
  const sire = lot.sire ?? lot.pedigree?.sire?.name ?? null
  const damSire = lot.pedigree?.dam?.sire?.name ?? null

  return (
    <div style={barStyle}>
      <div style={rowStyle}>
        {backTo && (
          <Link to={backTo} style={backLinkStyle} title="Terug naar de veiling">
            ← Naar veiling
          </Link>
        )}
        {onNavigate && (
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

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.6rem', flex: 1, minWidth: 0 }}>
          {lot.is_charity && (
            <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.7em', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontWeight: 700, letterSpacing: '0.06em' }}>
              🎁 CHARITY
            </span>
          )}
          <span style={lotnrStyle}>#{order}</span>
          <strong style={nameStyle}>{name}</strong>
          {showCatExtra && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              (Cat. nr {lot.number})
            </span>
          )}
          {age && <Pill label="Leeftijd" value={age} />}
          {minBedrag && <Pill label="Min" value={minBedrag} />}
          {sire && <Pill label="V." value={sire} />}
          {damSire && <Pill label="M.V." value={damSire} />}
        </div>

        {onNavigate && (
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
    </div>
  )
}

const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
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

function Pill({ label, value }) {
  return (
    <span style={pillStyle}>
      <span style={pillLabelStyle}>{label}</span>
      <span>{value}</span>
    </span>
  )
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
