import { Link, useParams } from 'react-router-dom'

export default function LotPage() {
  const { lotId } = useParams()
  return (
    <section>
      <p><Link to="/">← Veilinghuizen</Link></p>
      <h1>Lot-detail</h1>
      <p style={{ color: '#999' }}>(placeholder — komt in stap 5-7)</p>
      <p style={{ color: '#999', fontFamily: 'monospace' }}>lotId = {lotId}</p>
    </section>
  )
}
