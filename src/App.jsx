import { Routes, Route, Link } from 'react-router-dom'
import HousesPage from './pages/HousesPage'
import HousePage from './pages/HousePage'
import AuctionPage from './pages/AuctionPage'
import LotPage from './pages/LotPage'
import CockpitPage from './pages/CockpitPage'

export default function App() {
  return (
    <main style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: '2rem', maxWidth: 800 }}>
      <header style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid #ddd' }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#222' }}>
          <strong>Veiling Pro</strong>
        </Link>
      </header>

      <Routes>
        <Route path="/" element={<HousesPage />} />
        <Route path="/houses/:houseId" element={<HousePage />} />
        <Route path="/auctions/:auctionId" element={<AuctionPage />} />
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
