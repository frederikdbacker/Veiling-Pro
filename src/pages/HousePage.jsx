import { Link, useParams } from 'react-router-dom'

export default function HousePage() {
  const { houseId } = useParams()
  return (
    <section>
      <p><Link to="/">← Veilinghuizen</Link></p>
      <h1>Veilingen van dit huis</h1>
      <p style={{ color: '#999' }}>(placeholder — komt in stap 3)</p>
      <p style={{ color: '#999', fontFamily: 'monospace' }}>houseId = {houseId}</p>
    </section>
  )
}
