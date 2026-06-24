import { useEffect, useState } from 'react'
import { getWorkerStatus } from '../lib/scrapeJobs'

/**
 * Online/offline-lampje van de scrape-worker (worker_heartbeat, migratie 0035).
 * 🟢 online = de mini-worker leeft en verwerkt imports; 🔴 offline = jobs
 * blijven in de wachtrij tot de worker op de mini (her)start.
 *
 * Props:
 *   compact   true = klein lampje + woord (naast een knop); false = volledige
 *             regel met uitleg (in de "Collectie ophalen"-modal)
 *   pollMs    herhaalinterval om de status te verversen (default 20s)
 */
export default function WorkerStatusBadge({ compact = false, pollMs = 20000 }) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      const s = await getWorkerStatus()
      if (alive) setStatus(s)
    }
    tick()
    const t = setInterval(tick, pollMs)
    return () => { alive = false; clearInterval(t) }
  }, [pollMs])

  if (!status) return null
  const online = status.online
  const color = online ? 'var(--success, var(--accent))' : 'var(--danger)'

  if (compact) {
    const title = online
      ? `Import-worker draait (laatst gezien ${status.secondsAgo}s geleden)`
      : 'Import-worker ligt plat — start hem op de Mac mini'
    return (
      <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.85em', color: 'var(--text-muted)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
        Worker {online ? 'online' : 'offline'}
      </span>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      padding: '6px 10px', marginBottom: 'var(--space-3)',
      background: 'var(--bg-base, #111)', border: '1px solid var(--border-default)',
      borderLeft: `3px solid ${color}`, borderRadius: 'var(--radius-sm)', fontSize: '0.9em',
    }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      {online ? (
        <span style={{ color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Worker online</strong> — imports worden verwerkt.
        </span>
      ) : (
        <span style={{ color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--danger)' }}>Worker offline</strong> — je opdracht blijft in de wachtrij tot de worker op de Mac mini (her)start.
        </span>
      )}
    </div>
  )
}
