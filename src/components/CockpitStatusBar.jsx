/**
 * Statusbalk in de live cockpit — read-only.
 * Toont voortgang (X/N gehamerd), verkoopcijfers, voorlopige omzet,
 * gem. duur per lot en verwacht einduur, op basis van de huidige stand
 * van alle lots in deze veiling.
 */
export default function CockpitStatusBar({ lots }) {
  const total = lots.length
  if (total === 0) return null

  const hammered = lots.filter((l) => l.time_hammer != null)
  const sold     = hammered.filter((l) => l.sold === true)
  const notSold  = hammered.filter((l) => l.sold === false)
  const remaining = total - hammered.length

  // Empty state: nog niets gehamerd
  if (hammered.length === 0) {
    return (
      <section style={barStyle}>
        <strong>0/{total}</strong> gehamerd
        <span style={sepStyle}> · </span>
        <em style={{ color: 'var(--text-muted)' }}>nog geen verkopen</em>
      </section>
    )
  }

  const totalRevenue = sold.reduce((s, l) => s + (Number(l.sale_price) || 0), 0)

  const durations = hammered
    .map((l) => l.duration_seconds)
    .filter((s) => Number.isFinite(s) && s > 0)
  const avgDurationSec = durations.length > 0
    ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
    : null

  const lastHammerMs = Math.max(...hammered.map((l) => new Date(l.time_hammer).getTime()))
  const expectedEndMs = avgDurationSec != null && remaining > 0
    ? lastHammerMs + remaining * avgDurationSec * 1000
    : null

  const finished = remaining === 0
  const segments = []

  if (finished) {
    segments.push(
      <span key="done" style={{ color: 'var(--success)' }}>
        ✓ <strong>{total}/{total}</strong> · veiling klaar
      </span>
    )
    segments.push(<span key="sold"><strong>{sold.length}</strong> verkocht</span>)
    if (notSold.length > 0) {
      segments.push(<span key="not">{notSold.length} niet</span>)
    }
    segments.push(
      <span key="total">totaal <strong>€{formatNum(totalRevenue)}</strong></span>
    )
    if (avgDurationSec != null) {
      segments.push(
        <span key="avg">⌀ <strong>{formatMmSs(avgDurationSec)}</strong></span>
      )
    }
  } else {
    segments.push(
      <span key="prog"><strong>{hammered.length}/{total}</strong> gehamerd</span>
    )
    if (sold.length > 0) {
      segments.push(
        <span key="sold" style={{ color: 'var(--success)' }}>✓ {sold.length} verkocht</span>
      )
    }
    if (notSold.length > 0) {
      segments.push(
        <span key="not" style={{ color: 'var(--warning)' }}>⊘ {notSold.length} niet</span>
      )
    }
    segments.push(
      <span key="rev">omzet <strong>€{formatNum(totalRevenue)}</strong></span>
    )
    if (avgDurationSec != null) {
      segments.push(
        <span key="avg">⌀ <strong>{formatMmSs(avgDurationSec)}</strong></span>
      )
    }
    if (expectedEndMs != null) {
      segments.push(
        <span key="end">einde ~<strong>{formatHhMm(new Date(expectedEndMs))}</strong></span>
      )
    }
  }

  return (
    <section style={barStyle}>
      {segments.map((seg, i) => (
        <span key={`wrap-${i}`}>
          {i > 0 && <span style={sepStyle}> · </span>}
          {seg}
        </span>
      ))}
    </section>
  )
}

function formatNum(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 0 })
}

function formatMmSs(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatHhMm(date) {
  return date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
}

const barStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: '0.45rem 0.85rem',
  marginBottom: 'var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.875rem',
  lineHeight: 1.5,
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums',
}

const sepStyle = { color: 'var(--text-muted)' }
