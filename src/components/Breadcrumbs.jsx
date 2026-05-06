import { Link } from 'react-router-dom'

/**
 * Breadcrumbs — uniforme paadweergave bovenaan elke pagina.
 *
 * Props:
 *   trail  array van { label, to? } — laatste item zonder `to` is de
 *          huidige pagina (geen link, andere kleur)
 *
 * Voorbeeld:
 *   <Breadcrumbs trail={[
 *     { label: 'Veilinghuizen', to: '/' },
 *     { label: houseName, to: `/houses/${houseId}` },
 *     { label: collectionName, to: `/collections/${collectionId}` },
 *     { label: lotName },  // current — no to
 *   ]} />
 */
export default function Breadcrumbs({ trail }) {
  if (!Array.isArray(trail) || trail.length === 0) return null
  return (
    <nav aria-label="Broodkruimels" style={navStyle}>
      {trail.map((item, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {i > 0 && <span style={separatorStyle}>›</span>}
          {item.to ? (
            <Link to={item.to} style={linkStyle}>{item.label}</Link>
          ) : (
            <span style={currentStyle}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

const navStyle = {
  fontSize: '0.85rem',
  color: 'var(--text-muted)',
  margin: '0 0 var(--space-3) 0',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 8px',
  alignItems: 'center',
}
const linkStyle = {
  color: 'var(--text-muted)',
  textDecoration: 'none',
}
const currentStyle = {
  color: 'var(--text-secondary)',
}
const separatorStyle = {
  marginRight: 8,
  color: 'var(--text-muted)',
}
