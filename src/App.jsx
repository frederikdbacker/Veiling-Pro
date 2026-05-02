import { Routes, Route, Link } from 'react-router-dom'
import HousesPage from './pages/HousesPage'
import HousePage from './pages/HousePage'
import AuctionPage from './pages/AuctionPage'
import LotPage from './pages/LotPage'
import CockpitPage from './pages/CockpitPage'
import AuctionSummaryPage from './pages/AuctionSummaryPage'

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
        <Route path="/auctions/:auctionId" element={<AuctionPage />} />
        <Route path="/auctions/:auctionId/summary" element={<AuctionSummaryPage />} />
        <Route path="/lots/:lotId" element={<LotPage />} />
        <Route path="/cockpit/:auctionId" element={<CockpitPage />} />
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
