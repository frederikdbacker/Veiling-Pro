/**
 * Klikbaar logo voor externe links in de cockpit (Fase 3 item #18 uit
 * POST_ALOGA_ROADMAP.md).
 *
 * Toont:
 *   - <img> wanneer src gegeven is (gebruikt voor Auction page-logo
 *     dat per veilinghuis is — auction_houses.logo_url)
 *   - Anders een styled tekst-badge (gebruikt voor HippoMundo en
 *     Horsetelex zolang er geen ge-shipde logo-files zijn)
 *
 * Styling: wit-zwart, passend bij donker thema. Hoogte 28px voor
 * consistente uitlijning naast elkaar.
 *
 * Props:
 *   href     URL waar de link naartoe gaat
 *   src      optionele image-URL
 *   brand    fallback tekst-label (bv. "HIPPOMUNDO")
 *   title    hover-titel (bv. "HippoMundo openen")
 */
export default function LogoLink({ href, src, brand, title }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      style={containerStyle}
    >
      {src ? (
        <img
          src={src}
          alt={brand}
          style={{ height: 18, width: 'auto', display: 'block' }}
        />
      ) : (
        <span style={textBadgeStyle}>{brand}</span>
      )}
    </a>
  )
}

const containerStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 10px',
  background: '#fff',
  color: '#111',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  textDecoration: 'none',
  fontSize: '0.75em',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'opacity 120ms ease',
}
const textBadgeStyle = {
  whiteSpace: 'nowrap',
}
