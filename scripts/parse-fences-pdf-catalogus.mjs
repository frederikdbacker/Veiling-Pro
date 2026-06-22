// Parser voor een Fences-PDF-catalogus (extract via pdftotext -layout).
//
// Input:  data/fences-<vente>-pdf-raw.txt
// Output: data/fences-<vente>-pdf-enrichment.json
//
// Per paard:
//   - lot_number, name, vat
//   - sex, color, year, type_short, birth_info
//   - pedigree: geneste {sire,dam,name,studbook} structuur, 3 generaties
//     compatibel met src/components/PedigreeTree.jsx
//   - sire_description (vrije tekst onder de pedigree-tabel)
//   - maternal_line: { "1": "…", "2": "…", "3": "…", "4": "…", "summary": "…" }
//
// Strategie:
//   - PDF-pagina's gescheiden via form-feed (\f)
//   - Lot-pagina herkenbaar aan "(avec|sans) TVA   NAAM" patroon
//   - Vervolg-pagina (zonder eigen header) wordt geappend aan de vorige lot
//   - Pedigree-tabel: 3 kolommen op character-positie (col1/col2/col3)
//   - Moederlijn: split op "Nème mère"/"Nère mère" labels die alleen op
//     een eigen regel staan
//
// Gebruik:
//   node scripts/parse-fences-pdf-catalogus.mjs <raw.txt> <out.json> [--lot N]
//
// --lot N → debug-mode, parse alleen lot N en print JSON naar stdout

import { readFile, writeFile } from 'node:fs/promises'

const args = process.argv.slice(2)
const rawPath = args[0]
const outPath = args[1]
const lotIdx = args.indexOf('--lot')
const onlyLot = lotIdx >= 0 ? parseInt(args[lotIdx + 1], 10) : null

if (!rawPath || !outPath) {
  console.error('Usage: node scripts/parse-fences-pdf-catalogus.mjs <raw.txt> <out.json> [--lot N]')
  process.exit(1)
}

const raw = await readFile(rawPath, 'utf8')

// ─── 1. Split in pagina's ───────────────────────────────────────────────
const pages = raw.split('\f')

// ─── 2. Detecteer lot-pagina's en hun lot-nummer ────────────────────────
//
// Een lot-pagina herkennen we aan:
//   - eerste 5 niet-lege regels bevatten "(avec|sans) TVA"
//   - daar staat (op dezelfde regel of de volgende) de naam in HOOFDLETTERS
//   - ergens in de eerste 10 regels staat een regel met enkel een getal
//     (= het lotnummer, rechts uitgelijnd)
//
// Vervolg-pagina's (lange moederlijnen die over twee pagina's lopen) hebben
// GEEN eigen header maar wel inhoud — die plakken we aan de vorige lot.

const lotRegex = /^\s*(avec|sans)\s+TVA\b\s+(.+?)\s*$/
// Split-BTW notatie: paard met meerdere eigenaars in verschillende BTW-status,
// bv. "67% avec TVA" + "33% sans TVA" op losse regels. Geen naam erna; de
// naam staat onafhankelijk daaronder.
const splitVatRegex = /^\s*\d+\s*%\s*(avec|sans)\s+TVA\s*$/

function findHeaderInfo(page) {
  const lines = page.split('\n')
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    // Standaard formaat: "avec TVA <NAAM …>"
    const m = lines[i].match(lotRegex)
    if (m) return { vat: m[1] === 'avec' ? 'avec TVA' : 'sans TVA', headerLineIdx: i, headerText: lines[i] }
    // Split-BTW: vind eerste %-regel, vraagt aparte name-search
    if (splitVatRegex.test(lines[i])) {
      // Verzamel alle aansluitende %-regels (kan 2 of meer zijn)
      const vatLabels = [lines[i].trim()]
      let j = i + 1
      while (j < lines.length && splitVatRegex.test(lines[j])) {
        vatLabels.push(lines[j].trim()); j++
      }
      // Sla lege regels over en zoek de naam-regel (mag in caps zijn met
      // details-suffix). Toon de naam-regel als header.
      while (j < lines.length && !lines[j].trim()) j++
      if (j < lines.length) {
        return { vat: vatLabels.join(' + '), headerLineIdx: j, headerText: lines[j] }
      }
    }
  }
  return null
}

function findLotNumber(page) {
  const lines = page.split('\n')
  // Eerste 12 regels zoeken naar een regel met enkel cijfers (eventueel met spaces).
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const t = lines[i].trim()
    if (/^\d{1,3}$/.test(t)) return parseInt(t, 10)
  }
  return null
}

// ─── 3. Parse header (naam, geslacht/kleur/jaar, geboorte-info) ────────
//
// Twee voorkomende vormen:
//   "avec TVA   DIA BELLA COURTIER Z z. f. b.br. née en 2023"
//   "Née chez Happy Paddock Bv (Bel)"  (volgende regel)
//
//   "avec TVA   AMARE'S TIJANA VAN HET KEYSERSBOS"
//   "bwp. m. b. né en 2023 - Né chez Hans & Heidi …"  (volgende regel)
//
// We zoeken naar het patroon ".+ [zsf]?\.?\s*[mf]\.\s*[a-z.]+\s+(née?|né)\s+en\s+\d{4}"
// om geslacht/kleur/jaar te isoleren. Bevindt zich op header-regel of de regel
// erna. Naam = alles links daarvan, na "avec TVA"/"sans TVA".

// Sex-tokens: m. = mâle/hengst, f. = femelle/merrie, h. = hongre/ruin
const detailRegex = /\b([a-z]{1,4}\.)?\s*(m\.|f\.|h\.)\s+([a-z.]+(?:\s+[a-z.]+)*)\s+(née?|né)\s+en\s+(\d{4})\b/

function parseHeaderBlock(page, headerLineIdx, headerText) {
  const lines = page.split('\n')
  const headerStripped = headerText.replace(/^\s*(avec|sans)\s+TVA\b\s+/, '').trim()

  // Test of details OP de header-regel staan
  let name, sex, color, year, typeShort, birthInfo
  let detailLine = ''

  const inlineMatch = headerStripped.match(detailRegex)
  if (inlineMatch) {
    detailLine = headerStripped.substring(inlineMatch.index).trim()
    name = headerStripped.substring(0, inlineMatch.index).trim()
  } else {
    name = headerStripped
    // Zoek de details-regel op de volgende 1-3 regels
    for (let j = headerLineIdx + 1; j < Math.min(lines.length, headerLineIdx + 4); j++) {
      const m = lines[j].match(detailRegex)
      if (m) { detailLine = lines[j].trim(); break }
    }
  }

  if (detailLine) {
    const m = detailLine.match(detailRegex)
    if (m) {
      typeShort = m[1] ? m[1].replace('.', '') : null   // bv "z", "bwp", "sf"
      sex = m[2].replace('.', '')                        // "m" of "f"
      color = m[3].trim()                                // bv "b.br.", "n.", "al."
      year = parseInt(m[5], 10)
    }
    // Geboorte-info ook in detail-regel? Komt vaak als "… né en 2023 - Né chez …"
    const birthInline = detailLine.match(/(N[ée]e?\s+(?:chez|à|au)\s+.+?)\s*$/)
    if (birthInline) birthInfo = birthInline[1].trim()
  }

  // Geboorte-info kan ook op apart regel staan
  if (!birthInfo) {
    for (let j = headerLineIdx + 1; j < Math.min(lines.length, headerLineIdx + 5); j++) {
      const t = lines[j].trim()
      if (/^N[ée]e?\s+(?:chez|à|au)\s+/.test(t)) { birthInfo = t; break }
    }
  }

  return { name, sex: sex ?? null, color: color ?? null, year: year ?? null,
    type_short: typeShort ?? null, birth_info: birthInfo ?? null }
}

// ─── 4. Parse pedigree-tabel ───────────────────────────────────────────
//
// De tabel staat tussen de header en de eerste paragraaf-tekst onder de tabel
// (typisch een blok dat begint met de vadernaam in caps en een komma).
// We werken op character-positie:
//   - col1 (ouders): leading whitespace ≈ 45-60
//   - col2 (grootouders): leading whitespace ≈ 70-85
//   - col3 (overgrootouders): leading whitespace ≈ 95-115
//
// Strategie: verzamel alle non-empty regels in het pedigree-blok, meet hun
// leading-whitespace, cluster in drie kolommen via de relatieve grootte.

function extractPedigreeBlock(page, startLine) {
  const lines = page.split('\n')
  // Pedigree begint na de header + birth-info. We zoeken vanaf startLine
  // tot we een regel tegenkomen die er duidelijk uitziet als losse tekst
  // (lange paragraaf-regel met komma's, of de eerste "1ère mère"-marker).
  let pedStart = -1, pedEnd = -1
  for (let i = startLine; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!t) continue
    // Eerste cel (vader) zit normaal op kolom 40-65
    const leading = lines[i].length - lines[i].trimStart().length
    if (leading >= 30 && /^[A-ZÉÈÊÀÂÔÛÇÆŒ0-9'][A-ZÉÈÊÀÂÔÛÇÆŒ0-9'\s\-]/.test(t)) {
      pedStart = i
      break
    }
  }
  if (pedStart === -1) return { lines: [], endLine: startLine }

  // Vind het einde: een regel die op kolom 3-15 begint met hoofdletters +
  // komma (vader-beschrijving zoals "DIARADO, étalon holsteiner …"), OF de
  // eerste "Nère/Nème mère" marker.
  for (let i = pedStart + 1; i < lines.length; i++) {
    const t = lines[i].trimEnd()
    if (!t) continue
    const leading = lines[i].length - lines[i].trimStart().length
    const trimmed = t.trim()
    // Lange tekstregel met komma (vader-beschrijving)?
    if (leading <= 10 && /^[A-ZÉÈÊÀÂÔÛÇÆŒ][A-ZÉÈÊÀÂÔÛÇÆŒ0-9\s'\-]*,\s/.test(trimmed)) {
      pedEnd = i; break
    }
    // "1ère mère" of "Nème mère" label?
    if (/^(1ère|[2-9]ème)\s+mère\b/.test(trimmed)) {
      pedEnd = i; break
    }
  }
  if (pedEnd === -1) pedEnd = lines.length

  // Per regel: split in afzonderlijke cellen wanneer er ≥5 spaties tussen
  // staan. Sommige lots hebben twee kolommen op één regel (bv. NIFRANE DU
  // VASSAL: "NIXON VAN'T   DENZEL V'T MEULENHOF" op col 1 + col 2).
  const cells = []
  for (let i = pedStart; i < pedEnd; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    for (const c of splitRowIntoCells(line)) {
      if (isPedigreeWatermark(c.text)) continue
      cells.push({ raw: line, indent: c.startCol, text: c.text, lineIdx: i })
    }
  }
  return { lines: cells, endLine: pedEnd }
}

// Splits een regel in cellen: elke cel = aaneengesloten tekst zonder ≥5
// opeenvolgende spaties erbinnen. Geeft [{startCol, text}, ...] terug.
function splitRowIntoCells(line) {
  const result = []
  let pos = 0
  while (pos < line.length) {
    while (pos < line.length && line[pos] === ' ') pos++
    if (pos >= line.length) break
    const start = pos
    let consec = 0
    let lastNonSpace = pos
    while (pos < line.length) {
      if (line[pos] === ' ') {
        consec++
        if (consec >= 5) break
      } else {
        consec = 0
        lastNonSpace = pos
      }
      pos++
    }
    const t = line.substring(start, lastNonSpace + 1).trim()
    if (t) result.push({ startCol: start, text: t })
  }
  return result
}

// Filtert page-footer/watermark-strings die soms midden in pedigree-tabel
// verschijnen (Fences-specifiek, beide vacation-dagen).
function isPedigreeWatermark(text) {
  return /^Vente du (Lundi|Mardi)\s+\d+\s+(juin|juillet)\s+\d{4}\b/i.test(text)
}

// Cluster de pedigree-regels in 3 kolommen op basis van indent.
// In de Fences-catalogus zijn de drie kolommen consistent verschoven:
//   col1 ~ 45-65, col2 ~ 70-90, col3 ~ 95-120.
function classifyColumn(indent) {
  if (indent < 70) return 1
  if (indent < 95) return 2
  return 3
}

// Mergen van multi-line cellen. Tracked per kolom (interleaved cells in
// verschillende kolommen breken de "directe voorganger"-heuristiek).
// - Col 1 (ouders): kan multi-line zijn (bv. NIXON VAN'T / MEULENHOF / bwp).
// - Col 2 (grootouders) en col 3 (overgrootouders): vaste aantallen (4 en 8),
//   geen merge — voorkomt false-positives bij dichte stapeling.
// Studbook-token (kort lowercase) altijd toegevoegd aan de huidige col1-cell,
// ook over grote regel-afstand (cell is verticaal-gecentreerd in PDF).
function mergeMultiLineCells(rows) {
  const byCol = { 1: null, 2: null, 3: null }
  const out = []
  for (const r of rows) {
    const prev = byCol[r.col]
    if (prev && r.col === 1) {
      const lineDist = r.lineIdx - prev.lastLineIdx
      const indentClose = Math.abs(prev.indent - r.indent) <= 8
      if ((indentClose && lineDist <= 4) || isStudbookOnly(r.text)) {
        prev.text = prev.text + ' ' + r.text
        prev.lastLineIdx = r.lineIdx
        continue
      }
    }
    const fresh = { ...r, lastLineIdx: r.lineIdx }
    out.push(fresh)
    byCol[r.col] = fresh
  }
  return out
}

const STUDBOOK_TOKENS = new Set([
  'holst', 'sf', 'kwpn', 'bwp', 'oldbg', 'old', 'hann', 'han', 'sbs', 'z',
  'westf', 'dsp', 'aes', 'sba', 'oc', 'ps', 'cm', 'hol', 'irl', 'sba', 'pre',
  'sla', 'dsa', 'dwb', 'mecklbg', 'meck', 'isr', 'nrps',
])
function isStudbookOnly(text) {
  const cleaned = text.toLowerCase().replace(/\.$/, '').trim()
  return STUDBOOK_TOKENS.has(cleaned)
}

// Splits "naam studbook" → { name, studbook }
function splitStudbook(text) {
  // Studbook = laatste token in lowercase (1-6 chars, eventueel "."-suffix)
  const m = text.match(/^(.+?)\s+([a-z]{1,6}\.?)$/)
  if (m) return { name: m[1].trim(), studbook: m[2] }
  return { name: text.trim(), studbook: null }
}

function parsePedigreeBlock(pedBlock) {
  const cells = pedBlock.lines.map((r) => ({ col: classifyColumn(r.indent), indent: r.indent, text: r.text, lineIdx: r.lineIdx }))
  const merged = mergeMultiLineCells(cells)

  const col1 = merged.filter((c) => c.col === 1)
  const col2 = merged.filter((c) => c.col === 2)
  const col3 = merged.filter((c) => c.col === 3)

  // Verwacht: col1=2 (sire,dam), col2=4 (sire.sire, sire.dam, dam.sire, dam.dam),
  // col3=8 (alle overgrootouders, leesvolgorde top→bottom)
  const sire = col1[0] ? splitStudbook(col1[0].text) : null
  const dam = col1[1] ? splitStudbook(col1[1].text) : null

  const node = (cell) => cell ? splitStudbook(cell.text) : null
  const sireSire = node(col2[0])
  const sireDam  = node(col2[1])
  const damSire  = node(col2[2])
  const damDam   = node(col2[3])

  // Overgrootouders in leesvolgorde top→bottom (Fences-layout):
  // 0: sire.sire.sire, 1: sire.sire.dam
  // 2: sire.dam.sire,  3: sire.dam.dam
  // 4: dam.sire.sire,  5: dam.sire.dam
  // 6: dam.dam.sire,   7: dam.dam.dam
  const gg = col3.map(node)

  if (sire && sireSire) {
    sire.sire = sireSire
    if (sire.sire) {
      if (gg[0]) sire.sire.sire = gg[0]
      if (gg[1]) sire.sire.dam  = gg[1]
    }
  }
  if (sire && sireDam) {
    sire.dam = sireDam
    if (sire.dam) {
      if (gg[2]) sire.dam.sire = gg[2]
      if (gg[3]) sire.dam.dam  = gg[3]
    }
  }
  if (dam && damSire) {
    dam.sire = damSire
    if (dam.sire) {
      if (gg[4]) dam.sire.sire = gg[4]
      if (gg[5]) dam.sire.dam  = gg[5]
    }
  }
  if (dam && damDam) {
    dam.dam = damDam
    if (dam.dam) {
      if (gg[6]) dam.dam.sire = gg[6]
      if (gg[7]) dam.dam.dam  = gg[7]
    }
  }

  return {
    pedigree: { sire, dam },
    debug: { col1_count: col1.length, col2_count: col2.length, col3_count: col3.length },
  }
}

// ─── 5. Parse moederlijn ───────────────────────────────────────────────
//
// Vanaf pedEnd loopt alles tot het einde van het lot (pageEnd). De labels
// "1ère mère", "2ème mère", "3ème mère", "4ème mère" staan elk op een eigen
// regel met kleine indent (5-15 spaces). Tekst eromheen hoort visueel bij
// het label dat ernaast staat — maar in tekst-extract komt het label
// midden in het tekstblok. We splitsen op label-regels en wijzen de
// blokken toe.

const labelRegex = /^\s*(1ère|[2-9]ème)\s+mère\s*$/i

// Elke moeder-paragraaf opent vast met:
//   NAAM (f. <kleur> née en YYYY) Fille d[e'] …
// Dat anker is veel betrouwbaarder dan de "Nème mère"-labels (die staan
// verticaal-gecentreerd ergens in de paragraaf, niet bovenaan).
// Nakomelingen-vermeldingen openen NIET met "(f./m. ..." maar met een
// jaartal: "Numero Uno-T (2009, h. b. ...)", dus die matchen niet.
const damParaRegex = /^[\p{Lu}0-9'’"\s\-]+\s*\(\s*f\.\s.*née\s+en\s+\d{4}.*\)\s+Fille\s+d/u

function parseMaternalLine(page, fromLine) {
  const lines = page.split('\n')

  // 1) sire_description = van fromLine tot de eerste moeder-paragraaf-opener
  let firstDamLine = -1
  for (let k = fromLine; k < lines.length; k++) {
    if (damParaRegex.test(lines[k].trim())) { firstDamLine = k; break }
  }
  const sireDescEnd = firstDamLine === -1 ? lines.length : firstDamLine
  const sireDescLines = []
  for (let k = fromLine; k < sireDescEnd; k++) {
    const t = lines[k].trim()
    if (!t) continue
    if (labelRegex.test(t)) continue
    sireDescLines.push(t)
  }
  const sireDescription = sireDescLines.join(' ').replace(/\s{2,}/g, ' ').trim() || null

  // 2) summary = vanaf eerste "On retrouve …"-regel
  let summaryStart = -1
  for (let k = (firstDamLine === -1 ? fromLine : firstDamLine); k < lines.length; k++) {
    if (/^On retrouve\b/i.test(lines[k].trim())) { summaryStart = k; break }
  }
  let summary = null
  if (summaryStart >= 0) {
    const s = []
    for (let k = summaryStart; k < lines.length; k++) {
      const t = lines[k].trim()
      if (t) s.push(t)
    }
    summary = s.join(' ').replace(/\s{2,}/g, ' ').trim()
  }

  // 3) Vind alle moeder-paragraaf-openers tussen firstDamLine en summaryStart
  const damOpens = []
  if (firstDamLine >= 0) {
    const upperBound = summaryStart >= 0 ? summaryStart : lines.length
    for (let k = firstDamLine; k < upperBound; k++) {
      if (damParaRegex.test(lines[k].trim())) damOpens.push(k)
    }
  }

  // 4) Per moeder-paragraaf: alle tekstregels vanaf de opener tot de volgende
  //    opener (of tot summary), label-regels uitgefilterd.
  const upperBound = summaryStart >= 0 ? summaryStart : lines.length
  const dams = damOpens.map((openLine, idx) => {
    const endLine = damOpens[idx + 1] ?? upperBound
    const txt = []
    for (let k = openLine; k < endLine; k++) {
      const t = lines[k].trim()
      if (!t) continue
      if (labelRegex.test(t)) continue
      txt.push(t)
    }
    return txt.join(' ').replace(/\s{2,}/g, ' ').trim()
  })

  return {
    sire_description: sireDescription,
    1: dams[0] ?? null,
    2: dams[1] ?? null,
    3: dams[2] ?? null,
    4: dams[3] ?? null,
    summary,
    _dams_found: dams.length,
  }
}

// ─── 6. Hoofd-pipeline ─────────────────────────────────────────────────

const lots = []
let currentLot = null

for (let pi = 0; pi < pages.length; pi++) {
  const page = pages[pi]
  const header = findHeaderInfo(page)
  if (!header) {
    // Mogelijk vervolg-pagina van een lopend lot (lange moederlijn). Negeer
    // voor nu — we tellen pas hoeveel er voorkomen.
    continue
  }

  const lotNumber = findLotNumber(page)
  const headerInfo = parseHeaderBlock(page, header.headerLineIdx, header.headerText)

  // Pedigree-blok start na de geboorte-info (typisch 2-4 regels onder header)
  const lines = page.split('\n')
  // Skip de header-regel + maximaal 4 regels (details + birth)
  let pedStartFrom = header.headerLineIdx + 1
  // Skip lege regels en het lotnummer (regel met enkel cijfer)
  while (pedStartFrom < lines.length) {
    const t = lines[pedStartFrom].trim()
    if (!t) { pedStartFrom++; continue }
    if (/^\d{1,3}$/.test(t)) { pedStartFrom++; continue }
    if (/^N[ée]e?\s+(?:chez|à|au)\s+/.test(t)) { pedStartFrom++; continue }
    if (detailRegex.test(t)) { pedStartFrom++; continue }
    break
  }

  const pedBlock = extractPedigreeBlock(page, pedStartFrom)
  const pedParsed = parsePedigreeBlock(pedBlock)
  const matLine = parseMaternalLine(page, pedBlock.endLine)

  const lot = {
    lot_number: lotNumber,
    name: headerInfo.name,
    vat: header.vat,
    sex: headerInfo.sex,
    color: headerInfo.color,
    year: headerInfo.year,
    type_short: headerInfo.type_short,
    birth_info: headerInfo.birth_info,
    pedigree: pedParsed.pedigree,
    sire_description: matLine.sire_description,
    maternal_line: {
      1: matLine[1] || null,
      2: matLine[2] || null,
      3: matLine[3] || null,
      4: matLine[4] || null,
      summary: matLine.summary,
    },
    _debug: pedParsed.debug,
  }

  if (onlyLot != null && lotNumber !== onlyLot) {
    currentLot = null
    continue
  }

  lots.push(lot)
  currentLot = lot
}

if (onlyLot != null) {
  if (lots.length === 0) {
    console.error(`Lot ${onlyLot} niet gevonden`)
    process.exit(2)
  }
  console.log(JSON.stringify(lots[0], null, 2))
} else {
  await writeFile(outPath, JSON.stringify({ meta: { source: rawPath, count: lots.length }, lots }, null, 2))
  console.log(`✓ ${lots.length} lots geparsed → ${outPath}`)
  // Korte statistiek
  const withMaternal = lots.filter((l) => l.maternal_line[1]).length
  const withSire = lots.filter((l) => l.pedigree.sire?.sire).length
  const withDam = lots.filter((l) => l.pedigree.dam?.sire).length
  console.log(`  - ${withSire}/${lots.length} hebben paternale grootouders`)
  console.log(`  - ${withDam}/${lots.length} hebben maternale grootouders`)
  console.log(`  - ${withMaternal}/${lots.length} hebben 1ère mère tekst`)
}
