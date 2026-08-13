import { useState } from 'react'
import { centralAuth } from '../lib/centralAuth'

// ============================================================
// Inlogscherm — e-mail + wachtwoord tegen de centrale login.
// Geen registratie en geen wachtwoord-reset: accounts worden
// centraal aangemaakt (central-auth admin-pagina).
// ============================================================

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await centralAuth.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (error) {
      // Generieke, niet-verklikkende melding.
      setError('Inloggen mislukt. Controleer je e-mail en wachtwoord.')
      return
    }
    // Bij succes neemt AuthProvider het over (onAuthStateChange).
  }

  return (
    <div style={styles.wrap}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Veiling Pro</h1>
        <p style={styles.subtitle}>Log in om verder te gaan</p>

        <label style={styles.label} htmlFor="login-email">
          E-mailadres
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          disabled={busy}
        />

        <label style={styles.label} htmlFor="login-password">
          Wachtwoord
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          disabled={busy}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" style={styles.button} disabled={busy}>
          {busy ? 'Bezig met inloggen…' : 'Inloggen'}
        </button>
      </form>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-5)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    margin: '0 0 var(--space-1)',
    fontSize: '1.5rem',
  },
  subtitle: {
    margin: '0 0 var(--space-5)',
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
  },
  label: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: 'var(--space-1)',
  },
  input: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    padding: 'var(--space-3)',
    fontSize: '1rem',
    marginBottom: 'var(--space-4)',
  },
  button: {
    marginTop: 'var(--space-2)',
    background: 'var(--accent)',
    color: '#0b2016',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-3)',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: 'var(--danger)',
    fontSize: '0.9rem',
    margin: '0 0 var(--space-3)',
  },
}
