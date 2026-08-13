import { useEffect, useState } from 'react'
import Modal from './Modal'
import { listShares, getOrCreateShare, revokeShare, shareUrl } from '../lib/shares'

// ============================================================
// ShareLinksModal — beheer van de afgeschermde deellinks van een collectie.
//
// Toont de actieve link (kopieerbaar) + een historiek van eerdere links met de
// mogelijkheid ze in te trekken. Een ingetrokken link wordt NIET gewist (audit),
// enkel op revoked gezet; de gedeelde weergave geeft er daarna niets meer voor.
// ============================================================

export default function ShareLinksModal({ collectionId, onClose }) {
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(null)

  async function reload() {
    setLoading(true)
    try {
      setShares(await listShares(collectionId))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [collectionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const nowIso = new Date().toISOString()
  const isActive = (s) => !s.revoked_at && (s.expires_at == null || s.expires_at > nowIso)
  const active = shares.filter(isActive)
  const revoked = shares.filter((s) => !isActive(s))

  async function handleCreate() {
    setBusy(true)
    try {
      await getOrCreateShare(collectionId)
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy(token) {
    try {
      await navigator.clipboard.writeText(shareUrl(token))
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleRevoke(id) {
    if (!window.confirm('Deze deellink intrekken? Wie de link heeft, kan het overzicht daarna niet meer openen.')) return
    setBusy(true)
    try {
      await revokeShare(id)
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <h2 style={{ margin: '0 0 var(--space-2)' }}>🔒 Deellinks</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 0 }}>
        Een deellink geeft organisatoren enkel het eindoverzicht van deze veiling —
        geen toegang tot de rest van de app. Intrekken kan altijd.
      </p>

      {error && <p style={{ color: 'var(--danger)' }}>❌ {error}</p>}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Laden…</p>
      ) : (
        <>
          <section style={{ marginTop: 'var(--space-3)' }}>
            <h3 style={sectionHeadingStyle}>Actief ({active.length})</h3>
            {active.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nog geen actieve deellink.</p>
            ) : (
              <ul style={listStyle}>
                {active.map((s) => (
                  <li key={s.id} style={rowStyle}>
                    <code style={codeStyle} title={shareUrl(s.token)}>/gedeeld/{s.token.slice(0, 12)}…</code>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button onClick={() => handleCopy(s.token)} style={btnStyle}>
                        {copied === s.token ? '✓ Gekopieerd' : '📋 Kopiëren'}
                      </button>
                      <button onClick={() => handleRevoke(s.id)} disabled={busy} style={dangerBtnStyle}>
                        Intrekken
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={handleCreate} disabled={busy} style={{ ...btnStyle, marginTop: 'var(--space-2)' }}>
              ＋ Nieuwe link
            </button>
          </section>

          {revoked.length > 0 && (
            <section style={{ marginTop: 'var(--space-4)' }}>
              <h3 style={sectionHeadingStyle}>Ingetrokken / verlopen ({revoked.length})</h3>
              <ul style={listStyle}>
                {revoked.map((s) => (
                  <li key={s.id} style={{ ...rowStyle, opacity: 0.6 }}>
                    <code style={codeStyle}>/gedeeld/{s.token.slice(0, 12)}…</code>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {s.revoked_at ? 'ingetrokken' : 'verlopen'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Modal>
  )
}

const sectionHeadingStyle = { fontSize: '0.95rem', margin: '0 0 var(--space-2)', color: 'var(--text-secondary)' }
const listStyle = { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }
const rowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)',
  flexWrap: 'wrap',
  padding: 'var(--space-2) var(--space-3)',
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
}
const codeStyle = { fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }
const btnStyle = {
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
  padding: '4px 12px', fontSize: '0.85rem', cursor: 'pointer',
}
const dangerBtnStyle = { ...btnStyle, color: 'var(--danger)' }
