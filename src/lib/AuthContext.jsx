import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { centralAuth, PROJECT_KEY } from './centralAuth'

// ============================================================
// AuthContext — één plek die de inlogstatus + de projectrol bewaakt.
//
// - session: de Supabase-sessie (of null als niet ingelogd)
// - role:    'admin' | 'user' | null (null = ingelogd maar geen toegang
//            tot Veiling Pro)
// - status:  'loading' | 'anon' | 'no-access' | 'ready'
//
// Schermen kunnen op `role` filteren via useAuth().
// ============================================================

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth() moet binnen <AuthProvider> gebruikt worden.')
  return ctx
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  // 'loading' tot we de sessie én (indien ingelogd) de rol kennen.
  const [status, setStatus] = useState('loading')
  const [roleError, setRoleError] = useState(null)

  // Haal de rol op voor de ingelogde gebruiker. user_id filteren we
  // NIET: RLS in het centrale project toont alleen de eigen rol-rijen.
  const loadRole = useCallback(async () => {
    setRoleError(null)
    const { data, error } = await centralAuth
      .from('user_roles')
      .select('role')
      .eq('project', PROJECT_KEY)
      .maybeSingle()

    if (error) {
      // Netwerk-/serverfout — niet verwarren met "geen toegang".
      setRole(null)
      setRoleError(error.message)
      setStatus('no-access')
      return
    }
    if (!data) {
      setRole(null)
      setStatus('no-access')
      return
    }
    setRole(data.role)
    setStatus('ready')
  }, [])

  useEffect(() => {
    let active = true

    // 1. Bestaande sessie ophalen bij opstart.
    centralAuth.auth.getSession().then(({ data }) => {
      if (!active) return
      const s = data.session
      setSession(s)
      if (s) {
        loadRole()
      } else {
        setStatus('anon')
      }
    })

    // 2. Meeluisteren op login/logout/token-refresh.
    const { data: sub } = centralAuth.auth.onAuthStateChange((_event, s) => {
      if (!active) return
      setSession(s)
      if (s) {
        setStatus('loading')
        loadRole()
      } else {
        setRole(null)
        setStatus('anon')
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadRole])

  const signOut = useCallback(async () => {
    await centralAuth.auth.signOut()
    // onAuthStateChange zet de state verder terug naar 'anon'.
  }, [])

  const value = {
    session,
    role,
    status,
    roleError,
    isAdmin: role === 'admin',
    signOut,
    retryRole: loadRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
