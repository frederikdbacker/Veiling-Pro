import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

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

export default function PedigreeTree({ pedigree, annotations, editable, lotId }) {
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
    <>
      <div className="pedigree-scroll">
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
      </div>
      <PedigreeTexts pedigree={pedigree} lotId={lotId} />
    </>
  )
}

/**
 * Toont onder de bracket-tree per voorouder uit de moederlijn een tekstblok
 * (Père / 1ère / 2ème / 3ème / 4ème mère). Wordt automatisch verborgen
 * wanneer er geen `text`-veld in `pedigree` staat — bv. voor lots buiten
 * Fences die deze data niet hebben.
 */
const BLOCK_PATHS = {
  sire:         ['sire'],
  dam:          ['dam'],
  damdam:       ['dam', 'dam'],
  damdamdam:    ['dam', 'dam', 'dam'],
  damdamdamdam: ['dam', 'dam', 'dam', 'dam'],
}

function PedigreeTexts({ pedigree, lotId }) {
  const blocks = [
    { key: 'sire',         label: 'Père',       node: pedigree?.sire },
    { key: 'dam',          label: '1ère mère',  node: pedigree?.dam },
    { key: 'damdam',       label: '2ème mère',  node: nodeOf(pedigree?.dam?.dam) },
    { key: 'damdamdam',    label: '3ème mère',  node: nodeOf(pedigree?.dam?.dam?.dam) },
    { key: 'damdamdamdam', label: '4ème mère',  node: nodeOf(pedigree?.dam?.dam?.dam?.dam) },
  ].filter((b) => b.node && typeof b.node === 'object' && b.node.text)

  // Start ingeklapt — gebruiker klikt om een blok te openen.
  const [open, setOpen] = useState({})
  // Pop-up button bij selectie: { key, x, y, range: {start, end} } of null.
  const [popup, setPopup] = useState(null)
  // Lokale highlights-cache zodat de UI optimistisch updatet vóór de DB-write.
  const [localPed, setLocalPed] = useState(pedigree)
  useEffect(() => { setLocalPed(pedigree) }, [pedigree])

  function handleMouseUp(blockKey, bodyEl) {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) { setPopup(null); return }
    const range = sel.getRangeAt(0)
    if (!bodyEl || !bodyEl.contains(range.commonAncestorContainer)) {
      setPopup(null); return
    }
    const start = getCharOffset(bodyEl, range.startContainer, range.startOffset)
    const end   = getCharOffset(bodyEl, range.endContainer,   range.endOffset)
    if (end <= start) { setPopup(null); return }
    const rect = range.getBoundingClientRect()
    setPopup({
      key: blockKey,
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY,
      range: { start, end },
    })
  }

  async function addHighlight() {
    if (!popup || !lotId) return
    const { key, range } = popup
    const path = BLOCK_PATHS[key]
    const next = addHighlightToPedigree(localPed, path, range)
    setLocalPed(next)
    setPopup(null)
    window.getSelection()?.removeAllRanges()
    await supabase.from('lots').update({ pedigree: next }).eq('id', lotId)
  }

  async function removeHighlightAt(blockKey, charIndex) {
    if (!lotId) return
    const path = BLOCK_PATHS[blockKey]
    const next = removeHighlightFromPedigree(localPed, path, charIndex)
    setLocalPed(next)
    await supabase.from('lots').update({ pedigree: next }).eq('id', lotId)
  }

  if (blocks.length === 0) return null

  return (
    <div style={textsContainerStyle}>
      {blocks.map(({ key, label, node: oldNode }) => {
        // Gebruik lokale (mogelijk geüpdate) versie van de node
        const localNode = getNodeAtPath(localPed, BLOCK_PATHS[key]) ?? oldNode
        const isOpen = !!open[key]
        const highlights = localNode.highlights ?? []
        return (
          <div key={key} style={textBlockStyle}>
            <button
              type="button"
              onClick={() => setOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
              style={textHeaderBtnStyle}
              aria-expanded={isOpen}
            >
              <span style={chevronStyle}>{isOpen ? '▾' : '▸'}</span>
              <span style={textLabelStyle}>{label}</span>
              <span style={textNameStyle}>{localNode.name}</span>
            </button>
            {isOpen ? (
              <p
                style={textBodyStyle}
                onMouseUp={(e) => handleMouseUp(key, e.currentTarget)}
              >
                {renderTextWithHighlights(
                  localNode.text,
                  highlights,
                  (charIndex) => removeHighlightAt(key, charIndex),
                )}
              </p>
            ) : (
              <p style={textTeaserStyle}>{teaserFrom(localNode.text)}</p>
            )}
          </div>
        )
      })}
      {popup && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); addHighlight() }}
          style={{
            ...highlightPopupStyle,
            left: popup.x,
            top: popup.y - 36,
          }}
        >
          ✦ Markeer
        </button>
      )}
    </div>
  )
}

/** Bepaal char-offset binnen `container` van een (node, offset) DOM-positie. */
function getCharOffset(container, node, offset) {
  if (!container.contains(node)) return 0
  let chars = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  let current = walker.nextNode()
  while (current) {
    if (current === node) return chars + offset
    chars += current.length
    current = walker.nextNode()
  }
  return chars
}

/** Render text als alternerende plain + <mark> segments. */
function renderTextWithHighlights(text, highlights, onRemove) {
  if (!highlights || highlights.length === 0) return text
  // Normaliseer en sorteer overlappende highlights
  const merged = mergeRanges(highlights)
  const parts = []
  let pos = 0
  merged.forEach((h, i) => {
    if (h.start > pos) parts.push(text.slice(pos, h.start))
    parts.push(
      <mark
        key={`h-${i}-${h.start}`}
        style={highlightStyle}
        onClick={() => onRemove(h.start)}
        title="Klik om markering te verwijderen"
      >
        {text.slice(h.start, h.end)}
      </mark>
    )
    pos = h.end
  })
  if (pos < text.length) parts.push(text.slice(pos))
  return parts
}

/** Eerste ~140 tekens van de tekst, op een natuurlijke breuk-punt afgekapt. */
function teaserFrom(text) {
  if (!text) return ''
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 140) return cleaned
  const cut = cleaned.slice(0, 140)
  const lastBreak = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf('. '), cut.lastIndexOf(' '))
  return (lastBreak > 80 ? cut.slice(0, lastBreak) : cut) + '…'
}

function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const out = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else out.push({ start: r.start, end: r.end })
  }
  return out
}

function getNodeAtPath(ped, path) {
  let node = ped
  for (const k of path) {
    if (node == null) return null
    if (typeof node === 'string') return null
    node = node[k]
  }
  return typeof node === 'string' ? { name: node } : node
}

function addHighlightToPedigree(ped, path, range) {
  const next = JSON.parse(JSON.stringify(ped || {}))
  let parent = next
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]
    let child = parent[k]
    if (typeof child === 'string') child = { name: child }
    if (!child) child = {}
    parent[k] = child
    parent = child
  }
  const last = path[path.length - 1]
  let target = parent[last]
  if (typeof target === 'string') target = { name: target }
  if (!target) target = {}
  const highlights = Array.isArray(target.highlights) ? [...target.highlights] : []
  highlights.push({ start: range.start, end: range.end })
  target.highlights = mergeRanges(highlights)
  parent[last] = target
  return next
}

function removeHighlightFromPedigree(ped, path, charIndex) {
  const next = JSON.parse(JSON.stringify(ped || {}))
  let parent = next
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]
    if (typeof parent[k] === 'string') parent[k] = { name: parent[k] }
    parent = parent[k]
    if (!parent) return ped
  }
  const last = path[path.length - 1]
  let target = parent[last]
  if (!target || typeof target === 'string') return ped
  const highlights = Array.isArray(target.highlights) ? target.highlights : []
  target.highlights = highlights.filter((h) => !(charIndex >= h.start && charIndex < h.end))
  parent[last] = target
  return next
}

function Box({ name, kind, gridRow, gridCol = 1, note = null, edit = null }) {
  const filled = name != null && String(name).trim().length > 0
  const showEdit = filled && edit
  const showNote = filled && !edit && note
  const hasLevel = (showEdit && edit.level) || !!showNote

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
        ...(showEdit ? editBoxStyle : (showNote ? noteBoxStyle : null)),
        ...(filled
          ? (kind === 'sire' ? sireStyle : damStyle)
          : emptyBoxStyle
        ),
      }}
    >
      <span style={{
        ...(showEdit ? nameInlineStyle : (showNote ? nameLineStyle : null)),
        ...(hasLevel ? { fontWeight: 800, color: 'var(--accent)' } : null),
      }}>
        {filled ? name : '—'}
      </span>

      {showNote && <span style={noteLineStyle}>{note}</span>}

      {/* Dropdowns naast/achter de naam op dezelfde regel (loopt door bij
          krappe ruimte). */}
      {showEdit && (
        <select value={edit.level} onChange={handleLevel}
                onClick={(e) => e.stopPropagation()}
                style={selectStyle} aria-label="Sportniveau">
          <option value="">niveau…</option>
          {LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
        </select>
      )}
      {showEdit && edit.level !== '' && (
        <select value={edit.result} onChange={handleResult}
                onClick={(e) => e.stopPropagation()}
                style={selectStyle} aria-label="Resultaat">
          <option value="">resultaat…</option>
          {RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
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
  gridTemplateRows: 'repeat(8, minmax(30px, auto))',
  gap: '4px',
  width: '100%',
}

const boxBaseStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
  padding: '6px 10px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.78rem',
  letterSpacing: '0.04em',
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
// Bewerkbaar dam-vakje: naam + dropdowns op één rij (naast/achter de naam),
// loopt door naar de volgende regel als de ruimte krap is.
const editBoxStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '4px',
  whiteSpace: 'normal',
}
const nameInlineStyle = {
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  flex: '0 1 auto', minWidth: 0,
}
const selectStyle = {
  flex: '0 0 auto',                    // even breed als de inhoud, niet krimpen/uitrekken
  maxWidth: '100%',
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

const textsContainerStyle = {
  marginTop: 'var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
}

const textBlockStyle = {
  borderLeft: '2px solid var(--border-default)',
  paddingLeft: 'var(--space-3)',
}

const textHeaderBtnStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  marginBottom: 2,
  flexWrap: 'wrap',
  background: 'none',
  border: 0,
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  color: 'inherit',
  fontFamily: 'inherit',
}

const chevronStyle = {
  display: 'inline-block',
  width: 12,
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  fontWeight: 600,
}

const textLabelStyle = {
  fontSize: '0.7rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontWeight: 600,
}

const textNameStyle = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
  letterSpacing: '0.04em',
}

const textBodyStyle = {
  margin: 0,
  fontSize: '0.8rem',
  lineHeight: 1.5,
  color: 'var(--text-secondary)',
  whiteSpace: 'pre-line',
}

const textTeaserStyle = {
  margin: '2px 0 0 22px',
  fontSize: '0.75rem',
  lineHeight: 1.4,
  color: 'var(--text-muted)',
  fontStyle: 'italic',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
}

const highlightStyle = {
  background: '#FBBF24',
  color: '#1A1A1A',
  padding: '0 2px',
  borderRadius: 2,
  cursor: 'pointer',
}

const highlightPopupStyle = {
  position: 'absolute',
  transform: 'translateX(-50%)',
  zIndex: 200,
  padding: '6px 12px',
  background: '#FBBF24',
  color: '#1A1A1A',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  fontFamily: 'inherit',
}
