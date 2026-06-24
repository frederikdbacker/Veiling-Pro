import { useState } from 'react'
import { Link } from 'react-router-dom'
import { STATUS_LABEL } from '../lib/scrapeJobs'

/**
 * Presentatie van de live-status van één scrape-job (URL-ingest).
 * Gedeeld door de ophaal-modal en het "Recente imports"-lijstje.
 *
 * Props:
 *   job        de scrape_jobs-rij (live bijgewerkt door de subscription)
 *   compact    true = één regel (voor de lijst); false = volledig blok (modal)
 *   onRetry    optioneel — toont "Opnieuw proberen" bij een mislukte job
 *   onCancel   optioneel — toont "Annuleer" zolang de job in de wachtrij staat
 */
export default function ScrapeJobStatus({ job, compact = false, onRetry, onCancel }) {
  const [showLog, setShowLog] = useState(false)
  if (!job) return null

  const label = STATUS_LABEL[job.status] || job.status
  const color = STATUS_COLOR[job.status] || 'var(--text-secondary)'
  const phase = job.progress?.phase
  const scraped = job.progress?.scraped
  const expected = job.progress?.expected
  const pct = expected ? Math.min(100, Math.round((scraped / expected) * 100)) : null

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: '0.9em' }}>
        <span style={{ color, fontWeight: 600 }}>{ICON[job.status] || ''} {label}</span>
        <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320, whiteSpace: 'nowrap' }}>
          {job.source_url}
        </span>
        {job.status === 'done' && job.collection_id && (
          <Link to={`/collections/${job.collection_id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
            {job.lots_imported != null ? `${job.lots_imported} lots →` : 'Open →'}
          </Link>
        )}
        {job.status === 'failed' && job.error && (
          <span style={{ color: 'var(--danger)' }}>— {job.error}</span>
        )}
        {job.status === 'queued' && onCancel && (
          <button onClick={() => onCancel(job)} style={linkBtnStyle}>Annuleer</button>
        )}
        {job.status === 'failed' && onRetry && (
          <button onClick={() => onRetry(job)} style={linkBtnStyle}>Opnieuw</button>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ color, fontWeight: 700, fontSize: '1.05em' }}>{ICON[job.status] || ''} {label}</span>
        {phase && job.status === 'running' && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>· {phase}{scraped != null ? ` (${scraped}${expected ? `/${expected}` : ''})` : ''}</span>
        )}
      </div>

      {/* Voortgangsbalk: bepaald percentage indien bekend, anders 'puls' tijdens bezig */}
      {(job.status === 'running' || job.status === 'queued') && (
        <div style={barOuter}>
          <div style={{
            ...barInner,
            width: pct != null ? `${pct}%` : '100%',
            opacity: pct != null ? 1 : 0.4,
            animation: pct == null ? 'vp-pulse 1.2s ease-in-out infinite' : 'none',
          }} />
        </div>
      )}

      {job.status === 'queued' && (
        <p style={hintStyle}>
          Wacht op de import-worker.{' '}
          {onCancel && <button onClick={() => onCancel(job)} style={linkBtnStyle}>Annuleer</button>}
        </p>
      )}

      {job.status === 'done' && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <p style={{ color: 'var(--text-primary)', margin: '0 0 var(--space-2)' }}>
            ✓ {job.lots_imported != null ? `${job.lots_imported} lots geladen.` : 'Collectie geladen.'}
          </p>
          {job.collection_id && (
            <Link to={`/collections/${job.collection_id}`} style={primaryLinkStyle}>Open collectie →</Link>
          )}
        </div>
      )}

      {job.status === 'failed' && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <p style={{ color: 'var(--danger)', margin: '0 0 var(--space-2)' }}>{job.error || 'Er ging iets mis.'}</p>
          {onRetry && <button onClick={() => onRetry(job)} style={primaryLinkStyle}>Opnieuw proberen</button>}
        </div>
      )}

      {job.log && (job.status === 'failed' || job.status === 'done') && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <button onClick={() => setShowLog((v) => !v)} style={linkBtnStyle}>
            {showLog ? '▴ Verberg details' : '▾ Toon details'}
          </button>
          {showLog && (
            <pre style={logStyle}>{job.log}</pre>
          )}
        </div>
      )}
    </div>
  )
}

const STATUS_COLOR = {
  queued: 'var(--text-secondary)',
  running: 'var(--accent)',
  done: 'var(--success, var(--accent))',
  failed: 'var(--danger)',
  canceled: 'var(--text-muted)',
}
const ICON = { queued: '⏳', running: '⏱', done: '✓', failed: '✗', canceled: '∅' }

const barOuter = {
  marginTop: 'var(--space-2)', height: 6, borderRadius: 3,
  background: 'var(--bg-base, #111)', overflow: 'hidden',
}
const barInner = {
  height: '100%', background: 'var(--accent)', borderRadius: 3,
  transition: 'width 0.4s ease',
}
const hintStyle = { color: 'var(--text-muted)', fontSize: '0.9em', marginTop: 'var(--space-2)' }
const linkBtnStyle = {
  background: 'transparent', border: 'none', color: 'var(--accent)',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9em', padding: 0, textDecoration: 'underline',
}
const primaryLinkStyle = {
  display: 'inline-block', padding: '6px 14px',
  background: 'var(--accent)', color: '#fff', textDecoration: 'none',
  borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.95em',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
const logStyle = {
  marginTop: 'var(--space-2)', maxHeight: 220, overflow: 'auto',
  background: 'var(--bg-base, #111)', color: 'var(--text-muted)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-2)', fontSize: '0.8em', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
}
