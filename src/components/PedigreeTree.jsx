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

export default function PedigreeTree({ pedigree, annotations, editable, lotId, renderTexts = true }) {
  // Lokale kopie zodat naam-correcties optimistisch zichtbaar zijn vóór de
  // DB-write klaar is.
  const [ped, setPed] = useState(pedigree)
  useEffect(() => { setPed(pedigree) }, [pedigree])

  const empty = !ped || (!ped.sire && !ped.dam)

  if (empty) {
    return (
      <p style={emptyStyle}>
        Pedigree nog niet beschikbaar.
      </p>
    )
  }

  const sire     = ped.sire ?? null
  const dam      = ped.dam  ?? null
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

  // Naam van een voorouder-vakje corrigeren (Fences-stamboom). Klik-om-te-
  // bewerken; namen dragen geen markeringen dus er kan niets verschuiven.
  // Read-modify-write (geserialiseerd per lot) zodat enkel de bewerkte knoop
  // verandert en snelle saves elkaar niet overschrijven.
  async function saveName(path, newName) {
    const value = newName.trim()
    const mutate = (p) => setNameAtPath(p, path, value)
    const localNext = mutate(ped)
    setPed(localNext)
    await persistPedigree(lotId, localNext, mutate)
  }
  // Naam-bewerking enkel aanbieden als we het lot kennen (kunnen opslaan).
  const nameEditFor = (path) => (lotId ? { path, onSave: saveName } : null)

  return (
    <>
      <div className="pedigree-scroll">
      <div style={treeStyle}>
        {/* Kolom 1 — ouders, elk span 4 */}
        <Box name={nameOf(sire)} kind="sire" gridRow="1 / span 4" nameEdit={nameEditFor(['sire'])} />
        <Box name={nameOf(dam)}  kind="dam"  gridRow="5 / span 4"
             note={noteText(annotations?.dam)}
             nameEdit={nameEditFor(['dam'])}
             edit={editFor('dam_sport_level', 'dam_result')} />

        {/* Kolom 2 — grootouders, elk span 2 */}
        <Box name={nameOf(sireSire)} kind="sire" gridRow="1 / span 2" gridCol={2} nameEdit={nameEditFor(['sire', 'sire'])} />
        <Box name={nameOf(sireDam)}  kind="dam"  gridRow="3 / span 2" gridCol={2} nameEdit={nameEditFor(['sire', 'dam'])} />
        <Box name={nameOf(damSire)}  kind="sire" gridRow="5 / span 2" gridCol={2} nameEdit={nameEditFor(['dam', 'sire'])} />
        <Box name={nameOf(damDam)}   kind="dam"  gridRow="7 / span 2" gridCol={2}
             note={noteText(annotations?.damsdam)}
             nameEdit={nameEditFor(['dam', 'dam'])}
             edit={editFor('damsdam_sport_level', 'damsdam_result')} />

        {/* Kolom 3 — overgrootouders, elk 1 rij */}
        <Box name={nameOf(sireSire?.sire)} kind="sire" gridRow="1 / span 1" gridCol={3} nameEdit={nameEditFor(['sire', 'sire', 'sire'])} />
        <Box name={nameOf(sireSire?.dam)}  kind="dam"  gridRow="2 / span 1" gridCol={3} nameEdit={nameEditFor(['sire', 'sire', 'dam'])} />
        <Box name={nameOf(sireDam?.sire)}  kind="sire" gridRow="3 / span 1" gridCol={3} nameEdit={nameEditFor(['sire', 'dam', 'sire'])} />
        <Box name={nameOf(sireDam?.dam)}   kind="dam"  gridRow="4 / span 1" gridCol={3} nameEdit={nameEditFor(['sire', 'dam', 'dam'])} />
        <Box name={nameOf(damSire?.sire)}  kind="sire" gridRow="5 / span 1" gridCol={3} nameEdit={nameEditFor(['dam', 'sire', 'sire'])} />
        <Box name={nameOf(damSire?.dam)}   kind="dam"  gridRow="6 / span 1" gridCol={3} nameEdit={nameEditFor(['dam', 'sire', 'dam'])} />
        <Box name={nameOf(damDam?.sire)}   kind="sire" gridRow="7 / span 1" gridCol={3} nameEdit={nameEditFor(['dam', 'dam', 'sire'])} />
        <Box name={nameOf(damDam?.dam)}    kind="dam"  gridRow="8 / span 1" gridCol={3}
             note={noteText(annotations?.damsdamsdam)}
             nameEdit={nameEditFor(['dam', 'dam', 'dam'])}
             edit={editFor('damsdamsdam_sport_level', 'damsdamsdam_result')} />
      </div>
      </div>
      {renderTexts && <PedigreeTexts pedigree={ped} lotId={lotId} />}
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

export function PedigreeTexts({ pedigree, lotId }) {
  // Lokale cache zodat de UI optimistisch updatet vóór de DB-write.
  const [localPed, setLocalPed] = useState(pedigree)
  useEffect(() => { setLocalPed(pedigree) }, [pedigree])

  const blocks = [
    { key: 'sire',         label: 'Père',       node: localPed?.sire },
    { key: 'dam',          label: '1ère mère',  node: localPed?.dam },
    { key: 'damdam',       label: '2ème mère',  node: nodeOf(localPed?.dam?.dam) },
    { key: 'damdamdam',    label: '3ème mère',  node: nodeOf(localPed?.dam?.dam?.dam) },
    { key: 'damdamdamdam', label: '4ème mère',  node: nodeOf(localPed?.dam?.dam?.dam?.dam) },
  ].filter((b) => b.node && typeof b.node === 'object' && b.node.text)

  // Alle pedigree-mutaties lopen via dezelfde geserialiseerde read-modify-write
  // (persistPedigree), zodat enkel de bewerkte knoop verandert.
  async function saveText(path, newText) {
    const mutate = (p) => setTextAtPath(p, path, newText)
    const localNext = mutate(localPed)
    setLocalPed(localNext)
    await persistPedigree(lotId, localNext, mutate)
  }
  async function addHighlightAt(path, range) {
    const mutate = (p) => addHighlightToPedigree(p, path, range)
    const localNext = mutate(localPed)
    setLocalPed(localNext)
    await persistPedigree(lotId, localNext, mutate)
  }
  async function removeHighlightAt(path, charIndex) {
    const mutate = (p) => removeHighlightFromPedigree(p, path, charIndex)
    const localNext = mutate(localPed)
    setLocalPed(localNext)
    await persistPedigree(lotId, localNext, mutate)
  }

  if (blocks.length === 0) return null

  return (
    <div style={textsContainerStyle}>
      {blocks.map(({ key, label, node }) => (
        <PedigreeTextBlock
          key={key}
          label={label}
          node={node}
          path={BLOCK_PATHS[key]}
          editable={!!lotId}
          onSaveText={saveText}
          onAddHighlight={addHighlightAt}
          onRemoveHighlight={removeHighlightAt}
        />
      ))}
    </div>
  )
}

/**
 * Eén voorouder-tekstblok (Père / 1ère mère / …). Geen modus: het gebaar zelf
 * bepaalt de actie, op basis van de selectie bij het loslaten van de muis.
 *   - Slepen over tekst (niet-lege selectie) → die selectie wordt een markering.
 *   - Klik op een bestaande markering (lege selectie op een <mark>) → ze wist.
 *   - Gewone klik op tekst (lege selectie) → bewerken (textarea). Bij opslaan
 *     schuiven bestaande markeringen mee met de correctie (remapHighlights).
 * Slepen en klikken sluiten elkaar uit (selectie wel/niet leeg), dus botsen ze
 * nooit en is er geen verborgen modus om te ontdekken.
 */
function PedigreeTextBlock({ label, node, path, editable, onSaveText, onAddHighlight, onRemoveHighlight }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.text ?? '')
  const bodyRef = useRef(null)

  // Verse externe tekst overnemen zolang we niet aan het typen zijn.
  useEffect(() => { if (!editing) setDraft(node.text ?? '') }, [node.text, editing])

  const highlights = node.highlights ?? []

  function handleBodyMouseUp(e) {
    if (!editable) return
    const bodyEl = bodyRef.current
    const sel = window.getSelection()
    // Gesleepte selectie binnen de tekst → markeren.
    if (sel && !sel.isCollapsed) {
      const range = sel.getRangeAt(0)
      if (bodyEl && bodyEl.contains(range.commonAncestorContainer)) {
        const start = getCharOffset(bodyEl, range.startContainer, range.startOffset)
        const end   = getCharOffset(bodyEl, range.endContainer,   range.endOffset)
        if (end > start) {
          onAddHighlight(path, { start, end })
          sel.removeAllRanges()
        }
      }
      return // selectie buiten dit blok of leeg-na-trim → niet bewerken
    }
    // Lege klik op het ✕-wisknopje → die markering bewust wissen. Elke andere
    // klik (ook midden in een markering) → de tekst bewerken; de markering
    // blijft en schuift mee bij opslaan (remap).
    const rm = e.target.closest ? e.target.closest('[data-remove-mark]') : null
    if (rm) {
      onRemoveHighlight(path, Number(rm.dataset.removeMark))
      return
    }
    startEdit()
  }

  function startEdit() {
    if (!editable) return
    setDraft(node.text ?? '')
    setEditing(true)
  }
  function commitEdit() {
    setEditing(false)
    if (draft !== (node.text ?? '')) onSaveText(path, draft)
  }
  function cancelEdit() { setEditing(false); setDraft(node.text ?? '') }

  return (
    <div style={textBlockStyle}>
      <div style={textHeaderRowStyle}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={textHeaderBtnStyle}
          aria-expanded={open}
        >
          <span style={chevronStyle}>{open ? '▾' : '▸'}</span>
          <span style={textLabelStyle}>{label}</span>
          <span style={textNameStyle}>{node.name}</span>
        </button>
      </div>

      {open && editable && !editing && (
        <div style={markHintStyle}>
          ✦ Sleep over tekst = markeren · klik = corrigeren · klik op een markering = wissen
        </div>
      )}

      {open ? (
        editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit() }}
              rows={Math.min(14, Math.max(3, Math.ceil((draft.length || 1) / 60)))}
              style={textEditAreaStyle}
              autoFocus
            />
            <div style={editHintStyle}>Klik buiten het veld om te bewaren · Esc annuleert</div>
          </div>
        ) : (
          <p
            ref={bodyRef}
            style={{ ...textBodyStyle, cursor: 'text' }}
            onMouseUp={editable ? handleBodyMouseUp : undefined}
            title={editable ? 'Sleep om te markeren · klik om te corrigeren' : undefined}
          >
            {renderTextWithHighlights(node.text, highlights)}
          </p>
        )
      ) : (
        <p style={textTeaserStyle}>{teaserFrom(node.text)}</p>
      )}
    </div>
  )
}

/** Bepaal char-offset binnen `container` van een (node, offset) DOM-positie. */
function getCharOffset(container, node, offset) {
  if (!container.contains(node)) return 0
  let chars = 0
  // Tekst binnen het ✕-wisknopje hoort niet bij node.text en mag de offsets
  // dus niet verschuiven (anders zou de remap naar het verkeerde stuk wijzen).
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && n.parentElement.closest('[data-remove-mark]'))
      ? NodeFilter.FILTER_REJECT
      : NodeFilter.FILTER_ACCEPT,
  })
  let current = walker.nextNode()
  while (current) {
    if (current === node) return chars + offset
    chars += current.length
    current = walker.nextNode()
  }
  return chars
}

/**
 * Render text als alternerende plain + <mark> segments. Elke markering bevat een
 * klein ✕-overlay-knopje met `data-remove-mark={start}`; de klik-afhandeling op
 * de tekstbody gebruikt dat om net die markering te wissen. Het ✕ staat buiten
 * node.text en telt niet mee in de offsets (zie getCharOffset).
 */
function renderTextWithHighlights(text, highlights) {
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
        title="Klik op de tekst om te corrigeren · ✕ om de markering te wissen"
      >
        {text.slice(h.start, h.end)}
        <button
          type="button"
          data-remove-mark={h.start}
          style={removeMarkBtnStyle}
          title="Markering wissen"
          aria-label="Markering wissen"
        >×</button>
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

/** Zet de tekst van een voorouder-knoop en map bestaande markeringen mee. */
function setTextAtPath(ped, path, newText) {
  const next = JSON.parse(JSON.stringify(ped || {}))
  let parent = next
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]
    if (typeof parent[k] === 'string') parent[k] = { name: parent[k] }
    if (!parent[k]) parent[k] = {}
    parent = parent[k]
  }
  const last = path[path.length - 1]
  let target = parent[last]
  if (typeof target === 'string') target = { name: target }
  if (!target) target = {}
  const oldText = target.text ?? ''
  const oldHighlights = Array.isArray(target.highlights) ? target.highlights : []
  const remapped = remapHighlights(oldText, newText, oldHighlights)
  target.text = newText
  if (remapped.length) target.highlights = remapped
  else delete target.highlights
  parent[last] = target
  return next
}

/** Corrigeer de naam van een voorouder-knoop, met behoud van de rest. */
function setNameAtPath(ped, path, newName) {
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
  const target = parent[last]
  if (target && typeof target === 'object') {
    // Object-knoop (heeft mogelijk sire/dam/text/highlights) → enkel name aanpassen.
    parent[last] = { ...target, name: newName }
  } else {
    // Bladknoop (string of leeg) → als string bewaren.
    parent[last] = newName
  }
  return next
}

/**
 * Herbereken markerings-bereiken {start,end} wanneer de tekst van één knoop
 * gecorrigeerd wordt. Markeringen leven per knoop, dus ze kunnen nooit naar een
 * andere tak verspringen; binnen de knoop schuiven ze mee via een
 * prefix/suffix-diff zodat ze aan het gecorrigeerde stuk blijven hangen. Een
 * bereik dat volledig wordt weggewist (start == end) verdwijnt.
 */
function remapHighlights(oldText, newText, highlights) {
  if (!highlights || highlights.length === 0) return []
  if (oldText === newText) return mergeRanges(highlights)
  const oldLen = oldText.length
  const newLen = newText.length
  // Gemeenschappelijke prefix.
  let p = 0
  const maxP = Math.min(oldLen, newLen)
  while (p < maxP && oldText[p] === newText[p]) p++
  // Gemeenschappelijke suffix (niet overlappend met de prefix).
  let s = 0
  while (s < (maxP - p) && oldText[oldLen - 1 - s] === newText[newLen - 1 - s]) s++
  const oldMidEnd = oldLen - s   // [p, oldMidEnd) = vervangen stuk in oude tekst
  const newMidEnd = newLen - s
  const delta = newLen - oldLen
  const remap = (idx) => {
    if (idx <= p) return idx                       // vóór de bewerking
    if (idx >= oldMidEnd) return idx + delta        // ná de bewerking
    return Math.min(Math.max(idx, p), newMidEnd)    // binnen het bewerkte stuk → klem
  }
  const out = highlights
    .map((h) => ({ start: remap(h.start), end: remap(h.end) }))
    .filter((h) => h.end > h.start)
  return mergeRanges(out)
}

/**
 * Read-modify-write van de pedigree-jsonb, geserialiseerd per lot.
 *
 * `pedigree` is één jsonb-kolom, maar we lezen vlak vóór elke write de actuele
 * waarde opnieuw en passen enkel de bewerkte knoop toe (`mutate`), zodat geen
 * andere tak verloren gaat. De per-lot wachtrij zorgt dat twee snelle saves op
 * dezelfde knoop niet parallel lezen-en-schrijven: de tweede start pas nadat de
 * eerste klaar is. `fallbackNext` wordt enkel gebruikt als het verse lezen faalt.
 */
const pedWriteQueue = new Map()

async function persistPedigree(lotId, fallbackNext, mutate) {
  if (!lotId) return
  const run = async () => {
    const { data, error } = await supabase
      .from('lots').select('pedigree').eq('id', lotId).single()
    const base = error ? fallbackNext : mutate(data?.pedigree ?? {})
    const { error: writeError } = await supabase
      .from('lots').update({ pedigree: base }).eq('id', lotId)
    if (writeError) throw writeError
  }
  const prev = pedWriteQueue.get(lotId) ?? Promise.resolve()
  const job = prev.catch(() => {}).then(run)
  pedWriteQueue.set(lotId, job)
  job.finally(() => { if (pedWriteQueue.get(lotId) === job) pedWriteQueue.delete(lotId) })
  return job
}

function Box({ name, kind, gridRow, gridCol = 1, note = null, edit = null, nameEdit = null }) {
  const filled = name != null && String(name).trim().length > 0
  const showEdit = filled && edit
  const showNote = filled && !edit && note
  const hasLevel = (showEdit && edit.level) || !!showNote

  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')

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

  function startNameEdit(e) {
    if (!nameEdit) return
    e.stopPropagation()
    setDraftName(filled ? String(name) : '')
    setEditingName(true)
  }
  function commitName() {
    setEditingName(false)
    const v = draftName.trim()
    if (v !== (filled ? String(name) : '')) nameEdit.onSave(nameEdit.path, v)
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
      {editingName ? (
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') setEditingName(false)
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          style={nameInputStyle}
        />
      ) : (
        <span
          onClick={nameEdit ? startNameEdit : undefined}
          title={nameEdit ? 'Klik om de naam te corrigeren' : undefined}
          style={{
            ...(showEdit ? nameInlineStyle : (showNote ? nameLineStyle : null)),
            ...(hasLevel ? { fontWeight: 800, color: 'var(--accent)' } : null),
            ...(nameEdit ? { cursor: 'pointer' } : null),
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {filled ? name : '—'}
        </span>
      )}

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
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gridTemplateRows: 'repeat(8, minmax(26px, auto))',
  rowGap: 2,
  columnGap: 'var(--space-3)',
  width: '100%',
  padding: 'var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
}

const boxBaseStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
  minWidth: 0,
  padding: '4px 6px',
  fontSize: '0.78rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--text-primary)',
  background: 'transparent',
  borderBottom: '1px solid var(--border-default)',
}

// Sire en dam visueel gelijk — geen kleur per kant. De positie in de
// tree (boven = sire, onder = dam) maakt al duidelijk welk pad het is.
const sireStyle = {}
const damStyle  = {}

const emptyBoxStyle = {
  color: 'var(--text-muted)',
  fontStyle: 'italic',
  fontWeight: 400,
  borderBottom: '1px dashed var(--border-default)',
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

const textHeaderRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 2,
}

const textHeaderBtnStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  flexWrap: 'wrap',
  background: 'none',
  border: 0,
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
  flex: 1,
  minWidth: 0,
  color: 'inherit',
  fontFamily: 'inherit',
}

const markHintStyle = {
  margin: '0 0 6px 22px',
  fontSize: '0.68rem',
  color: 'var(--text-muted)',
  fontStyle: 'italic',
}

// ✕-wisknopje binnen een markering: visuele overlay, telt niet als tekst
// (user-select: none) en wordt door getCharOffset overgeslagen.
const removeMarkBtnStyle = {
  marginLeft: 4,
  padding: '0 4px',
  border: 0,
  borderRadius: 2,
  background: 'rgba(0,0,0,0.18)',
  color: '#1A1A1A',
  fontFamily: 'inherit',
  fontSize: '0.72rem',
  lineHeight: 1,
  fontWeight: 700,
  cursor: 'pointer',
  userSelect: 'none',
  verticalAlign: 'baseline',
}

const textEditAreaStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.5rem 0.65rem',
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  lineHeight: 1.5,
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius-sm)',
  resize: 'vertical',
}

const editHintStyle = {
  marginTop: 4,
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  fontStyle: 'italic',
}

const nameInputStyle = {
  font: 'inherit',
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  padding: '1px 4px',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius-sm)',
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
