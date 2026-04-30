import { Link, useParams } from 'react-router-dom'

export default function AuctionPage() {
  const { auctionId } = useParams()
  return (
    <section>
      <p><Link to="/">← Veilinghuizen</Link></p>
      <h1>Lots van deze veiling</h1>
      <p style={{ color: '#999' }}>(placeholder — komt in stap 4)</p>
      <p style={{ color: '#999', fontFamily: 'monospace' }}>auctionId = {auctionId}</p>
    </section>
  )
}
