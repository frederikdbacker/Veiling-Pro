/**
 * Compacte strip die spotters van links naar rechts toont, zoals
 * Frederik ze in de zaal ziet staan. Gebruikt op cockpit tussen de
 * statusbalk en de actief-lot picker. Klein lettertype, één regel,
 * neemt nauwelijks ruimte.
 *
 * Hover op een naam toont de locatie (bv. "links vlakbij") als tooltip.
 */
export default function SpottersStrip({ spotters }) {
  if (!spotters || spotters.length === 0) return null

  return (
    <div style={stripStyle}>
      <span style={iconStyle} aria-hidden>👥</span>
      {spotters.map((s, i) => (
        <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span style={sepStyle}>·</span>}
          {s.photo_url && (
            <img
              src={s.photo_url} alt=""
              width={20} height={20}
              style={photoStyle}
              loading="lazy"
            />
          )}
          <span
            title={s.location ?? ''}
            style={{ color: 'var(--text-primary)' }}
          >
            {s.name}
          </span>
        </span>
      ))}
    </div>
  )
}

const stripStyle = {
  display: 'flex', alignItems: 'center',
  gap: 8, flexWrap: 'wrap',
  padding: 'var(--space-2) var(--space-3)',
  marginBottom: 'var(--space-3)',
  background: 'transparent',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
}
const iconStyle = {
  fontSize: '1em',
  marginRight: 4,
}
const sepStyle = {
  color: 'var(--text-muted)',
}
const photoStyle = {
  objectFit: 'cover',
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--border-default)',
}
