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
        padding: 'var(--space-6) var(--space-5)',
        maxWidth: 1100,
        margin: '0 auto',
        minHeight: '100vh',
      }}
    >
      <header
        style={{
          marginBottom: 'var(--space-5)',
          paddingBottom: 'var(--space-3)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <Link
          to="/"
          style={{
            textDecoration: 'none',
            color: 'var(--accent)',
            fontWeight: 600,
            fontSize: '1.05rem',
            letterSpacing: '0.04em',
          }}
        >
          VEILING PRO
        </Link>
      </header>

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
