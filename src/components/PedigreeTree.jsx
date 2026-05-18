/**
 * Toont de afstamming over 3 generaties als boom:
 *   kol 1 = ouders (V/M), kol 2 = grootouders, kol 3 = overgrootouders.
 *
 * Verwacht de geneste structuur uit lots.pedigree:
 *   { sire: { name, sire:{name,sire,dam}, dam:{name,sire,dam} },
 *     dam:  { name, sire:{...}, dam:{...} } }
 * gen3 (sire/dam binnen gen2) zijn naam-strings.
 */
export default function PedigreeTree({ pedigree }) {
  if (!pedigree || (!pedigree.sire && !pedigree.dam)) return null

  // Genereer de 8 gen3-rijen (volgorde = van boven naar onder in de boom).
  const g2 = [
    pedigree.sire?.sire, pedigree.sire?.dam,
    pedigree.dam?.sire,  pedigree.dam?.dam,
  ]
  const g3 = g2.flatMap((n) => [nameOf(n?.sire), nameOf(n?.dam)])

  return (
    <div style={{ display: 'flex', gap: 8, fontSize: '0.85em', alignItems: 'stretch' }}>
      {/* Generatie 1 — ouders */}
      <Col>
        <Cell node={pedigree.sire} accent strong />
        <Cell node={pedigree.dam} accent strong />
      </Col>
      {/* Generatie 2 — grootouders */}
      <Col>
        {g2.map((n, i) => <Cell key={i} node={n} />)}
      </Col>
      {/* Generatie 3 — overgrootouders */}
      <Col>
        {g3.map((nm, i) => <Cell key={i} node={nm} muted />)}
      </Col>
    </div>
  )
}

function nameOf(v) {
  if (v == null) return null
  return typeof v === 'string' ? v : v.name ?? null
}

function Col({ children }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {children}
    </div>
  )
}

function Cell({ node, accent, strong, muted }) {
  const name = nameOf(node)
  return (
    <div
      style={{
        flex: 1,
        display: 'flex', alignItems: 'center',
        padding: '0.5rem 0.6rem',
        background: name ? '#f5f5f5' : '#fafafa',
        borderLeft: accent ? '3px solid #E08A1E' : '3px solid transparent',
        borderRadius: 4,
        color: name ? (muted ? '#777' : '#222') : '#bbb',
        fontWeight: strong ? 600 : 400,
        fontStyle: name ? 'normal' : 'italic',
        minHeight: 34,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}
      title={name || undefined}
    >
      {name || '—'}
    </div>
  )
}
