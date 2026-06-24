import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import ScrapeJobStatus from './ScrapeJobStatus'
import WorkerStatusBadge from './WorkerStatusBadge'
import { analyzeUrl } from '../lib/scraperRegistry'
import { createScrapeJob, subscribeJob, cancelJob, getJob } from '../lib/scrapeJobs'

/**
 * Modal "Collectie ophalen" / "Catalogus ophalen via URL".
 * De gebruiker plakt een collectie-link; de registry geeft direct feedback
 * (welk huis/scraper); "Collectie ophalen" maakt een scrape-job aan en de
 * modal toont daarna de live-status (via Supabase realtime, polling-fallback).
 *
 * Props:
 *   houseId, houseName   context van het veilinghuis
 *   collectionId         doelcollectie (refresh) of null (create)
 *   mode                 'create' | 'refresh'
 *   initialUrl           voorgevulde URL (bv. collection.source_url bij refresh)
 *   onClose              sluit de modal
 *   onJobChange          callback bij elke statuswijziging (parent kan herladen)
 */
export default function CollectionIngestModal({
  houseId = null, houseName = null, collectionId = null,
  mode = 'create', initialUrl = '', onClose, onJobChange,
}) {
  const [url, setUrl] = useState(initialUrl || '')
  const [job, setJob] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const analysis = useMemo(
    () => (url.trim() ? analyzeUrl(url, { houseName }) : null),
    [url, houseName],
  )

  // create-modus kan geen Fences-catalogus aan (importer vereist bestaande collectie)
  const blockedFences = !!(analysis?.ok && analysis.scraper.needsExistingCollection && mode === 'create')
  const canProceed = !!(analysis?.ok && analysis.argsOk && !blockedFences)
  const noScraper = analysis?.ok === false && analysis.reason === 'no_scraper'
  const invalidUrl = analysis?.ok === false && analysis.reason === 'invalid_url'

  // Live-status volgen zodra er een job is.
  useEffect(() => {
    if (!job?.id) return
    onJobChange?.(job)
    const unsub = subscribeJob(job.id, (updated) => {
      setJob(updated)
      onJobChange?.(updated)
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id])

  async function startJob(scraperKey) {
    setBusy(true); setErr(null)
    try {
      const created = await createScrapeJob({ sourceUrl: url, houseId, collectionId, mode, scraperKey })
      setJob(created)
    } catch (e) {
      setErr(e.message || 'Aanmaken van de ophaal-taak mislukte.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRetry() {
    // Audit-veilig: een NIEUWE job-rij i.p.v. de oude te overschrijven.
    await startJob(analysis?.ok ? analysis.scraper.key : null)
  }

  async function handleCancel(j) {
    try {
      await cancelJob(j.id)
      const fresh = await getJob(j.id)
      if (fresh) setJob(fresh)
    } catch (e) { setErr(e.message) }
  }

  const title = mode === 'refresh' ? 'Catalogus ophalen via URL' : 'Collectie ophalen'

  return (
    <Modal onClose={onClose} maxWidth={560}>
      <h2 style={{ marginTop: 0, color: 'var(--text-primary)' }}>{title}</h2>

      <WorkerStatusBadge />

      {!job && (
        <>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92em', marginTop: 0 }}>
            {mode === 'refresh'
              ? 'Plak de link naar de online catalogus van deze collectie. De lots worden opgehaald en in deze collectie gezet.'
              : 'Plak de link naar de collectie op de site van het veilinghuis. De juiste scraper wordt automatisch gekozen.'}
          </p>

          <label style={labelStyle}>Collectie-link</label>
          <input
            type="url"
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Plak hier de link naar de collectie"
            style={inputStyle}
            spellCheck={false}
          />

          {/* Live registry-feedback */}
          <div style={{ minHeight: 24, marginTop: 'var(--space-2)', fontSize: '0.9em' }}>
            {invalidUrl && <span style={{ color: 'var(--text-muted)' }}>Dit lijkt nog geen geldige link.</span>}
            {analysis?.ok && canProceed && (
              <span style={{ color: 'var(--success, var(--accent))' }}>
                ✅ <strong>{analysis.scraper.label}</strong>
                {analysis.houseName ? ` — ${analysis.houseName}` : ''} · klaar om op te halen.
              </span>
            )}
            {analysis?.ok && !analysis.argsOk && !blockedFences && (
              <span style={{ color: 'var(--danger)' }}>⚠️ {analysis.message}</span>
            )}
            {blockedFences && (
              <span style={{ color: 'var(--danger)' }}>
                ⚠️ Een Fences-catalogus haal je op vanuit de bestaande collectie (knop "Catalogus ophalen via URL"), niet hier.
              </span>
            )}
            {noScraper && (
              <span style={{ color: 'var(--text-secondary)' }}>
                Voor deze website is er nog <strong>geen scraper</strong>. Je kan de link bewaren; Claude Code voegt er dan een toe.
              </span>
            )}
          </div>

          {err && <p style={{ color: 'var(--danger)' }}>❌ {err}</p>}

          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
            <button
              onClick={() => startJob(analysis?.ok ? analysis.scraper.key : null)}
              disabled={!canProceed || busy}
              style={{ ...primaryBtnStyle, opacity: (!canProceed || busy) ? 0.45 : 1, cursor: (!canProceed || busy) ? 'not-allowed' : 'pointer' }}
            >
              {busy ? 'Bezig…' : 'Collectie ophalen'}
            </button>
            {noScraper && (
              <button onClick={() => startJob(null)} disabled={busy} style={secondaryBtnStyle}>
                Bewaar de link toch
              </button>
            )}
            <button onClick={onClose} disabled={busy} style={secondaryBtnStyle}>Annuleer</button>
          </div>
        </>
      )}

      {job && (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85em', wordBreak: 'break-all', marginTop: 0 }}>{job.source_url}</p>
          <ScrapeJobStatus job={job} onRetry={handleRetry} onCancel={handleCancel} />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <button onClick={onClose} style={secondaryBtnStyle}>Sluiten</button>
          </div>
        </>
      )}
    </Modal>
  )
}

const labelStyle = { display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.9em', color: 'var(--text-primary)' }
const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  background: 'var(--bg-input, #1a1a1a)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit', fontSize: '0.95em',
}
const primaryBtnStyle = {
  padding: '8px 16px', background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', opacity: 1,
}
const secondaryBtnStyle = {
  padding: '8px 16px', background: 'transparent', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
}
