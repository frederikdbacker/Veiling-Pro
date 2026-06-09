import { Routes, Route, Link, useLocation } from 'react-router-dom'
import HousesPage from './pages/HousesPage'
import HousePage from './pages/HousePage'
import ClientsPage from './pages/ClientsPage'
import CollectionPage from './pages/CollectionPage'
import CollectionClientsPage from './pages/CollectionClientsPage'
import LotPage from './pages/LotPage'
import CockpitPage from './pages/CockpitPage'
import CollectionSummaryPage from './pages/CollectionSummaryPage'

export default function App() {
  const { pathname } = useLocation()
  // Cockpit is een live veiling-werkscherm en mag de volle viewport-breedte
  // gebruiken; andere pages blijven gecentreerd op 1100px voor leesbaarheid.
  const isCockpit = pathname.startsWith('/cockpit/')
  return (
    <main
      style={{
        padding: 'var(--space-5) var(--space-5)',
        maxWidth: isCockpit ? 1800 : 1100,
        margin: '0 auto',
        minHeight: '100vh',
      }}
    >
      <Routes>
        <Route path="/" element={<HousesPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/houses/:houseId" element={<HousePage />} />
        <Route path="/collections/:collectionId" element={<CollectionPage />} />
        <Route path="/collections/:collectionId/clients" element={<CollectionClientsPage />} />
        <Route path="/collections/:collectionId/summary" element={<CollectionSummaryPage />} />
        <Route path="/lots/:lotId" element={<LotPage />} />
        <Route path="/cockpit/:collectionId" element={<CockpitPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
  )
}

function NotFound() {
  return (
    <section>
      <h1>Pagina niet gevonden</h1>
      <p><Link to="/">← Terug naar start</Link></p>
    </section>
  )
}
