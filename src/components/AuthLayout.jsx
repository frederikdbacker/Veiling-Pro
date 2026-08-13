import { Outlet, useLocation } from 'react-router-dom'
import AuthGate from './AuthGate'

// ============================================================
// AuthLayout — de chrome + toegangspoort rond alle INTERNE routes.
//
// Alles wat via <Outlet/> hieronder valt, hangt achter <AuthGate> (login +
// rolcontrole) en binnen de gecentreerde <main>. De publieke deelroute
// /gedeeld/:token valt hier bewust BUITEN (zie App.jsx) en heeft dus geen
// login, geen AccountBar en geen app-navigatie.
// ============================================================

export default function AuthLayout() {
  const { pathname } = useLocation()
  // Cockpit is een live veiling-werkscherm en mag de volle viewport-breedte
  // gebruiken; andere pages blijven gecentreerd op 1100px voor leesbaarheid.
  const isCockpit = pathname.startsWith('/cockpit/')
  return (
    <AuthGate>
      <main
        style={{
          padding: 'var(--space-5) var(--space-5)',
          maxWidth: isCockpit ? 1800 : 1100,
          margin: '0 auto',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </main>
    </AuthGate>
  )
}
