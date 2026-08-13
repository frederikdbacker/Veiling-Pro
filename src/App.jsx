import { Routes, Route, Link } from 'react-router-dom'
import AuthLayout from './components/AuthLayout'
import HousesPage from './pages/HousesPage'
import HousePage from './pages/HousePage'
import ClientsPage from './pages/ClientsPage'
import SpottersPage from './pages/SpottersPage'
import CollectionPage from './pages/CollectionPage'
import CollectionClientsPage from './pages/CollectionClientsPage'
import LotPage from './pages/LotPage'
import CockpitPage from './pages/CockpitPage'
import CollectionSummaryPage from './pages/CollectionSummaryPage'
import SharedSummaryPage from './pages/SharedSummaryPage'

export default function App() {
  return (
    <Routes>
      {/* PUBLIEK — kale gedeelde weergave, buiten de login en zonder navigatie.
          Los van elke interne route; het token verraadt niets van de structuur. */}
      <Route path="/gedeeld/:token" element={<SharedSummaryPage />} />

      {/* INTERN — alles hieronder hangt achter de login (AuthLayout → AuthGate). */}
      <Route element={<AuthLayout />}>
        <Route path="/" element={<HousesPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/spotters" element={<SpottersPage />} />
        <Route path="/houses/:houseId" element={<HousePage />} />
        <Route path="/collections/:collectionId" element={<CollectionPage />} />
        <Route path="/collections/:collectionId/clients" element={<CollectionClientsPage />} />
        <Route path="/collections/:collectionId/summary" element={<CollectionSummaryPage />} />
        <Route path="/lots/:lotId" element={<LotPage />} />
        <Route path="/cockpit/:collectionId" element={<CockpitPage />} />
        <Route path="/cockpit/:collectionId/:dayId" element={<CockpitPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
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
