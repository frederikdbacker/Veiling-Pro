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
 * Sportprestaties per moederlijn (zie migratie 0025) worden IN de drie
 * dam-vakjes getoond, naast de merrienaam:
 *   - `editable` prop → dropdowns in het vakje (LotPage); kiest niveau, en
 *     het resultaat-dropdown verschijnt zodra een niveau gekozen is.
 *       editable = { values: {…6 kolommen}, onSave: (patch) => void }
 *   - alleen `annotations` prop → alleen-lezen tekst "1.50m – Winner"
 *     (Cockpit). Vorm: { dam:{level,result}, damsdam:{…}, damsdamsdam:{…} }
 * Zonder beide props verandert er niets aan het bestaande gedrag.
 */

const LEVELS = [
  '1.20m', '1.25m', '1.30m', '1.35m', '1.40m',
  '1.45m', '1.50m', '1.55m', '1.60m', 'Grand Prix',
]
const RESULTS = ['Placed', 'Winner']

export default function PedigreeTree({ pedigree, annotations, editable }) {
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

  // Bewerk-config per moederlijn (alleen wanneer editable meegegeven is).
  const editFor = (levelField, resultField) => editable
    ? {
        levelField, resultField,
        level: editable.values?.[levelField] ?? '',
        result: editable.values?.[resultField] ?? '',
        onSave: editable.onSave,
      }
    : null

  return (
    <div style={treeStyle}>
      {/* Kolom 1 — ouders, elk span 4 */}
      <Box name={nameOf(sire)} kind="sire" gridRow="1 / span 4" />
      <Box name={nameOf(dam)}  kind="dam"  gridRow="5 / span 4"
           note={noteText(annotations?.dam)}
           edit={editFor('dam_sport_level', 'dam_result')} />

      {/* Kolom 2 — grootouders, elk span 2 */}
      <Box name={nameOf(sireSire)} kind="sire" gridRow="1 / span 2" gridCol={2} />
      <Box name={nameOf(sireDam)}  kind="dam"  gridRow="3 / span 2" gridCol={2} />
      <Box name={nameOf(damSire)}  kind="sire" gridRow="5 / span 2" gridCol={2} />
      <Box name={nameOf(damDam)}   kind="dam"  gridRow="7 / span 2" gridCol={2}
           note={noteText(annotations?.damsdam)}
           edit={editFor('damsdam_sport_level', 'damsdam_result')} />

      {/* Kolom 3 — overgrootouders, elk 1 rij */}
      <Box name={nameOf(sireSire?.sire)} kind="sire" gridRow="1 / span 1" gridCol={3} />
      <Box name={nameOf(sireSire?.dam)}  kind="dam"  gridRow="2 / span 1" gridCol={3} />
      <Box name={nameOf(sireDam?.sire)}  kind="sire" gridRow="3 / span 1" gridCol={3} />
      <Box name={nameOf(sireDam?.dam)}   kind="dam"  gridRow="4 / span 1" gridCol={3} />
      <Box name={nameOf(damSire?.sire)}  kind="sire" gridRow="5 / span 1" gridCol={3} />
      <Box name={nameOf(damSire?.dam)}   kind="dam"  gridRow="6 / span 1" gridCol={3} />
      <Box name={nameOf(damDam?.sire)}   kind="sire" gridRow="7 / span 1" gridCol={3} />
      <Box name={nameOf(damDam?.dam)}    kind="dam"  gridRow="8 / span 1" gridCol={3}
           note={noteText(annotations?.damsdamsdam)}
           edit={editFor('damsdamsdam_sport_level', 'damsdamsdam_result')} />
    </div>
  )
}

function Box({ name, kind, gridRow, gridCol = 1, note = null, edit = null }) {
  const filled = name != null && String(name).trim().length > 0
  const showEdit = filled && edit
  const showNote = filled && !edit && note

  function handleLevel(e) {
    const level = e.target.value || null
    const patch = { [edit.levelField]: level }
    // Niveau gewist → resultaat ook wissen (en verbergen).
    if (!level) patch[edit.resultField] = null
    edit.onSave(patch)
  }
  function handleResult(e) {
    edit.onSave({ [edit.resultField]: e.target.value || null })
  }

  return (
    <div
      style={{
        gridRow,
        gridColumn: gridCol,
        ...boxBaseStyle,
        ...((showEdit || showNote) ? noteBoxStyle : null),
        ...(filled
          ? (kind === 'sire' ? sireStyle : damStyle)
          : emptyBoxStyle
        ),
      }}
    >
      <span style={(showEdit || showNote) ? nameLineStyle : undefined}>
        {filled ? name : '—'}
      </span>

      {showNote && <span style={noteLineStyle}>{note}</span>}

      {showEdit && (
        <div style={editRowStyle} onClick={(e) => e.stopPropagation()}>
          <select value={edit.level} onChange={handleLevel}
                  style={selectStyle} aria-label="Sportniveau">
            <option value="">niveau…</option>
            {LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
          </select>
          {edit.level !== '' && (
            <select value={edit.result} onChange={handleResult}
                    style={selectStyle} aria-label="Resultaat">
              <option value="">resultaat…</option>
              {RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </div>
      )}
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

// Box met annotatie/dropdowns: naam boven, prestatie/dropdowns eronder.
const noteBoxStyle = {
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'center',
  gap: '3px',
  paddingTop: '3px', paddingBottom: '3px',
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
const editRowStyle = {
  display: 'flex', flexWrap: 'wrap', gap: '3px',
}
const selectStyle = {
  flex: '1 1 auto', minWidth: 0,
  padding: '1px 2px',
  fontFamily: 'inherit', fontSize: '0.62rem',
  textTransform: 'none', letterSpacing: 'normal',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
}

const emptyStyle = {
  color: 'var(--text-muted)',
  fontStyle: 'italic',
  margin: 0,
}
