/**
 * PedigreeTree — 3-generatie bracket-tree.
 *
 * Verwacht een gestructureerde object met `sire` en `dam` op het hoogste
 * niveau (ouders), die elk een naam + nested sire/dam hebben (grootouders).
 * De grootouders bevatten op hun beurt sire/dam strings (overgrootouders).
 *
 * Layout: 3 kolommen. Mannelijke ouders/voorouders = grijs blokje;
 * vrouwelijke = groen accent-blokje. Bracket-uitlijning via CSS-grid:
 * elke kolom verdeelt 8 evenredige rijen, elk blok span N rijen.
 *
 * Optionele prop `annotations` toont sportprestaties naast de drie
 * moederlijn-merries (zie migratie 0025). Vorm:
 *   { dam: {level, result}, damsdam: {level, result}, damsdamsdam: {…} }
 * Zonder deze prop verandert er niets aan het bestaande gedrag.
 */
export default function PedigreeTree({ pedigree, annotations }) {
  const empty = !pedigree
    || (!pedigree.sire && !pedigree.dam)

  if (empty) {
    return (
      <p style={emptyStyle}>
        Pedigree nog niet beschikbaar.
      </p>
    )
  }

  const sire     = pedigree.sire ?? null
  const dam      = pedigree.dam  ?? null
  const sireSire = nodeOf(sire?.sire)
  const sireDam  = nodeOf(sire?.dam)
  const damSire  = nodeOf(dam?.sire)
  const damDam   = nodeOf(dam?.dam)

  return (
    <div style={treeStyle}>
      {/* Kolom 1 — ouders, elk span 4 */}
      <Box name={nameOf(sire)} kind="sire" gridRow="1 / span 4" />
      <Box name={nameOf(dam)}  kind="dam"  gridRow="5 / span 4" note={noteText(annotations?.dam)} />

      {/* Kolom 2 — grootouders, elk span 2 */}
      <Box name={nameOf(sireSire)} kind="sire" gridRow="1 / span 2" gridCol={2} />
      <Box name={nameOf(sireDam)}  kind="dam"  gridRow="3 / span 2" gridCol={2} />
      <Box name={nameOf(damSire)}  kind="sire" gridRow="5 / span 2" gridCol={2} />
      <Box name={nameOf(damDam)}   kind="dam"  gridRow="7 / span 2" gridCol={2} note={noteText(annotations?.damsdam)} />

      {/* Kolom 3 — overgrootouders, elk 1 rij */}
      <Box name={nameOf(sireSire?.sire)} kind="sire" gridRow="1 / span 1" gridCol={3} />
      <Box name={nameOf(sireSire?.dam)}  kind="dam"  gridRow="2 / span 1" gridCol={3} />
      <Box name={nameOf(sireDam?.sire)}  kind="sire" gridRow="3 / span 1" gridCol={3} />
      <Box name={nameOf(sireDam?.dam)}   kind="dam"  gridRow="4 / span 1" gridCol={3} />
      <Box name={nameOf(damSire?.sire)}  kind="sire" gridRow="5 / span 1" gridCol={3} />
      <Box name={nameOf(damSire?.dam)}   kind="dam"  gridRow="6 / span 1" gridCol={3} />
      <Box name={nameOf(damDam?.sire)}   kind="sire" gridRow="7 / span 1" gridCol={3} />
      <Box name={nameOf(damDam?.dam)}    kind="dam"  gridRow="8 / span 1" gridCol={3} note={noteText(annotations?.damsdamsdam)} />
    </div>
  )
}

function Box({ name, kind, gridRow, gridCol = 1, note = null }) {
  const filled = name != null && String(name).trim().length > 0
  const showNote = filled && note
  return (
    <div
      style={{
        gridRow,
        gridColumn: gridCol,
        ...boxBaseStyle,
        ...(showNote ? noteBoxStyle : null),
        ...(filled
          ? (kind === 'sire' ? sireStyle : damStyle)
          : emptyBoxStyle
        ),
      }}
    >
      <span style={showNote ? nameLineStyle : undefined}>{filled ? name : '—'}</span>
      {showNote && <span style={noteLineStyle}>{note}</span>}
    </div>
  )
}

/** "1.50m – Winner", of enkel "1.50m" als geen resultaat; null als geen niveau. */
function noteText(ann) {
  if (!ann || !ann.level) return null
  return ann.result ? `${ann.level} – ${ann.result}` : ann.level
}

/** Normaliseer node: string of object → object met name + optional sire/dam. */
function nodeOf(node) {
  if (node == null) return null
  if (typeof node === 'string') return { name: node }
  return node
}

function nameOf(node) {
  if (node == null) return null
  if (typeof node === 'string') return node
  return node.name ?? null
}

const treeStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gridTemplateRows: 'repeat(8, minmax(22px, auto))',
  gap: '4px',
  width: '100%',
}

const boxBaseStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
  padding: '2px 8px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.7rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--text-primary)',
  background: 'transparent',
  border: '1px solid var(--border-default)',
}

// Sire en dam visueel gelijk — geen kleur per kant. De positie in de
// tree (boven = sire, onder = dam) maakt al duidelijk welk pad het is.
const sireStyle = {}
const damStyle  = {}

const emptyBoxStyle = {
  color: 'var(--text-muted)',
  fontStyle: 'italic',
  fontWeight: 400,
  border: '1px dashed var(--border-default)',
}

// Box met sportprestatie-annotatie: naam boven, prestatie eronder.
const noteBoxStyle = {
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'center',
}
const nameLineStyle = {
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  maxWidth: '100%',
}
const noteLineStyle = {
  fontSize: '0.62rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: 'var(--accent)',
  textTransform: 'none',
}

const emptyStyle = {
  color: 'var(--text-muted)',
  fontStyle: 'italic',
  margin: 0,
}
