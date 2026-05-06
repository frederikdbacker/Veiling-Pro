import { Routes, Route, Link } from 'react-router-dom'
import HousesPage from './pages/HousesPage'
import HousePage from './pages/HousePage'
import CollectionPage from './pages/CollectionPage'
import LotPage from './pages/LotPage'
import CockpitPage from './pages/CockpitPage'
import CollectionSummaryPage from './pages/CollectionSummaryPage'

export default function App() {
  return (
    <main
      style={{
        padding: 'var(--space-5) var(--space-5)',
        maxWidth: 1100,
        margin: '0 auto',
        minHeight: '100vh',
      }}
    >
      <Routes>
        <Route path="/" element={<HousesPage />} />
        <Route path="/houses/:houseId" element={<HousePage />} />
        <Route path="/collections/:collectionId" element={<CollectionPage />} />
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
