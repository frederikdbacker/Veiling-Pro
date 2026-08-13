import { useAuth } from '../lib/AuthContext'
import LoginScreen from './LoginScreen'
import AccountBar from './AccountBar'

// ============================================================
// AuthGate — toegangspoort om de hele app.
//
//   loading    → neutrale laadstaat
//   anon       → inlogscherm
//   no-access  → ingelogd, maar geen rij in user_roles voor deze app
//   ready      → app tonen (children)
//
// LET OP: dit is een cosmetische poort. Zie het audit-rapport —
// de data zelf zit in een apart Supabase-project met open RLS.
// ============================================================

export default function AuthGate({ children }) {
  const { status, roleError, session, signOut, retryRole } = useAuth()

  if (status === 'loading') {
    return (
      <div style={styles.center}>
        <p style={styles.muted}>Bezig met laden…</p>
      </div>
    )
  }

  if (status === 'anon') {
    return <LoginScreen />
  }

  if (status === 'no-access') {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1 style={styles.title}>Geen toegang tot Veiling Pro</h1>
          {roleError ? (
            <>
              <p style={styles.text}>
                Je bent ingelogd als <strong>{session?.user?.email}</strong>, maar
                je toegang kon niet gecontroleerd worden.
              </p>
              <p style={styles.muted}>{roleError}</p>
              <button style={styles.secondary} onClick={retryRole}>
                Opnieuw proberen
              </button>
            </>
          ) : (
            <p style={styles.text}>
              Je bent ingelogd als <strong>{session?.user?.email}</strong>, maar dit
              account heeft geen toegang tot Veiling Pro. Vraag een beheerder om
              toegang.
            </p>
          )}
          <button style={styles.button} onClick={signOut}>
            Uitloggen
          </button>
        </div>
      </div>
    )
  }

  // status === 'ready'
  return (
    <>
      <AccountBar />
      {children}
    </>
  )
}

const styles = {
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-5)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    boxShadow: 'var(--shadow-lg)',
    textAlign: 'center',
  },
  title: { margin: '0 0 var(--space-4)', fontSize: '1.3rem' },
  text: { color: 'var(--text-primary)', margin: '0 0 var(--space-4)' },
  muted: { color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 var(--space-4)' },
  button: {
    background: 'var(--accent)',
    color: '#0b2016',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-3) var(--space-5)',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-2) var(--space-4)',
    fontSize: '0.95rem',
    cursor: 'pointer',
    marginBottom: 'var(--space-4)',
  },
}
