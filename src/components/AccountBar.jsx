import { useAuth } from '../lib/AuthContext'

// ============================================================
// AccountBar — kleine, vaste knop rechtsboven met het e-mailadres
// van de ingelogde gebruiker + een uitlogknop. Bewust onopvallend
// zodat hij de bestaande schermen (ook de brede cockpit) niet stoort.
// ============================================================

export default function AccountBar() {
  const { session, role, signOut } = useAuth()
  const email = session?.user?.email ?? ''

  return (
    <div style={styles.wrap}>
      <span style={styles.email} title={email}>
        {email}
        {role ? <span style={styles.role}> · {role}</span> : null}
      </span>
      <button style={styles.button} onClick={signOut}>
        Uitloggen
      </button>
    </div>
  )
}

const styles = {
  wrap: {
    position: 'fixed',
    top: 'var(--space-2)',
    right: 'var(--space-2)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-full)',
    padding: '4px 4px 4px var(--space-3)',
    boxShadow: 'var(--shadow-md)',
    maxWidth: '60vw',
  },
  email: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  role: { color: 'var(--text-muted)' },
  button: {
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-full)',
    padding: '4px 12px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
}
