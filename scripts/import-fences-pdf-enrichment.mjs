// Importeer de PDF-extractie van een Fences-catalogus in de bestaande
// lots-rijen van de bijbehorende collectie.
//
// Per lot wordt:
//   - `pedigree` (jsonb) slim-gemerged: knoop voor knoop. Een leeg DB-veld
//     wordt gevuld; een gelijk veld blijft; een verschillend veld wordt
//     NIET overschreven (DB heeft voorrang) en het conflict wordt gelogd.
//   - `maternal_line` (jsonb, migratie 0029) altijd gevuld (was leeg).
//
// Matching tussen JSON-lot en DB-lot: op `number` binnen de gegeven
// collectie. Naam wordt apart vergeleken als sanity-check (met
// normalisatie voor typografische apostroffen en dubbele spaties).
//
// Gebruik (verplicht --env-file voor Supabase-keys):
//   # Eerst dry-run op 1 lot
//   node --env-file=.env.local scripts/import-fences-pdf-enrichment.mjs \
//        data/fences-selection-2026-pdf-enrichment.json --lot 5
//
//   # Dry-run op alle lots
//   node --env-file=.env.local scripts/import-fences-pdf-enrichment.mjs \
//        data/fences-selection-2026-pdf-enrichment.json
//
//   # Echt schrijven (vereist expliciet --commit)
//   node --env-file=.env.local scripts/import-fences-pdf-enrichment.mjs \
//        data/fences-selection-2026-pdf-enrichment.json --commit
//
// Output bij --commit:
//   reports/<datum>_fences-pdf-merge-conflicten.md
// Bij dry-run wordt het rapport naar /tmp geschreven en het pad getoond.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'

const args = process.argv.slice(2)
const jsonPath = args[0]
const commit = args.includes('--commit')
const lotIdx = args.indexOf('--lot')
const onlyLot = lotIdx >= 0 ? parseInt(args[lotIdx + 1], 10) : null

if (!jsonPath) {
  console.error('Usage: node scripts/import-fences-pdf-enrichment.mjs <json> [--lot N] [--commit]')
  process.exit(1)
}

// La Vente de Deauville Sélection 2026 — Fences, 29 juni 2026, 76 lots
const COLLECTION_ID = 'a3c9ac43-25b9-46e1-a32f-c936cc378bc0'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!URL || !KEY) {
  console.error('❌ Env vars VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY ontbreken')
  console.error('   Gebruik: node --env-file=.env.local …')
  process.exit(1)
}
const sb = createClient(URL, KEY)

// ─── Helpers ───────────────────────────────────────────────────────────

const norm = (s) => (s ?? '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim()
const sameName = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase()

// Slim-merge één pedigree-knoop (sire/dam/grandparent/...). Beide knopen
// kunnen null/undefined zijn. Resultaat = DB-versie aangevuld met PDF-velden
// die ontbraken; conflicts pushed naar `conflicts`-array.
function mergeNode(dbNode, pdfNode, pathArr, conflicts) {
  if (!pdfNode) return dbNode ?? null
  if (!dbNode) return clone(pdfNode)

  const out = { ...dbNode }

  // name
  if (pdfNode.name) {
    if (!dbNode.name) {
      out.name = pdfNode.name
    } else if (!sameName(dbNode.name, pdfNode.name)) {
      conflicts.push({ path: pathArr.concat('name').join('.'), db: dbNode.name, pdf: pdfNode.name })
    }
  }

  // studbook
  if (pdfNode.studbook) {
    if (!dbNode.studbook) {
      out.studbook = pdfNode.studbook
    } else if (norm(dbNode.studbook).toLowerCase() !== norm(pdfNode.studbook).toLowerCase()) {
      conflicts.push({ path: pathArr.concat('studbook').join('.'), db: dbNode.studbook, pdf: pdfNode.studbook })
    }
  }

  // recursie sire/dam
  out.sire = mergeNode(dbNode.sire, pdfNode.sire, pathArr.concat('sire'), conflicts)
  out.dam  = mergeNode(dbNode.dam,  pdfNode.dam,  pathArr.concat('dam'),  conflicts)

  // null-velden niet expliciet bewaren
  if (out.sire == null) delete out.sire
  if (out.dam == null) delete out.dam

  return out
}

function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)) }

function mergePedigree(dbPed, pdfPed, conflicts) {
  const merged = {
    sire: mergeNode(dbPed?.sire, pdfPed?.sire, ['sire'], conflicts),
    dam:  mergeNode(dbPed?.dam,  pdfPed?.dam,  ['dam'],  conflicts),
  }
  if (merged.sire == null) delete merged.sire
  if (merged.dam == null) delete merged.dam
  // Bewaar ook eventuele andere velden uit dbPed die niet in onze drie-gens
  // boom zitten (zoals 'text'-annotaties uit migratie 0025).
  if (dbPed) {
    for (const k of Object.keys(dbPed)) {
      if (k !== 'sire' && k !== 'dam' && !(k in merged)) merged[k] = dbPed[k]
    }
  }
  return merged
}

// ─── Hoofd-pipeline ────────────────────────────────────────────────────

const jsonData = JSON.parse(await readFile(jsonPath, 'utf8'))
const pdfLots = onlyLot
  ? jsonData.lots.filter((l) => l.lot_number === onlyLot)
  : jsonData.lots

console.log(`📚 ${pdfLots.length} lot(s) uit PDF te verwerken${onlyLot ? ` (--lot ${onlyLot})` : ''}`)
console.log(`🎯 Doel-collectie: ${COLLECTION_ID}`)
console.log(`🔒 Mode: ${commit ? 'COMMIT — DB wordt geschreven' : 'DRY-RUN — geen DB-writes'}`)
console.log()

// Haal alle DB-lots op (één query)
const { data: dbLots, error } = await sb
  .from('lots').select('id, number, name, pedigree, maternal_line')
  .eq('collection_id', COLLECTION_ID)

if (error) { console.error('❌ DB-query mislukt:', error); process.exit(2) }

const dbByNumber = new Map(dbLots.map((l) => [l.number, l]))

const allConflicts = []
const summary = { matched: 0, missing: 0, namesMismatch: 0, pedFilledFresh: 0, pedConflicts: 0, mlFilled: 0, mlAlready: 0, written: 0 }

for (const pdfLot of pdfLots) {
  const dbLot = dbByNumber.get(pdfLot.lot_number)
  if (!dbLot) {
    summary.missing++
    console.warn(`⚠ lot ${pdfLot.lot_number} (${pdfLot.name}) — geen DB-rij gevonden, overgeslagen`)
    continue
  }
  summary.matched++
  const nameMatch = sameName(dbLot.name, pdfLot.name)
  if (!nameMatch) {
    summary.namesMismatch++
    console.warn(`⚠ lot ${pdfLot.lot_number} — naam-verschil: DB="${dbLot.name}" PDF="${pdfLot.name}" (gaat door op nummer)`)
  }

  const lotConflicts = []
  const wasEmpty = !dbLot.pedigree || (!dbLot.pedigree.sire && !dbLot.pedigree.dam)
  const mergedPed = mergePedigree(dbLot.pedigree, pdfLot.pedigree, lotConflicts)
  const newPed = wasEmpty ? pdfLot.pedigree : mergedPed

  if (wasEmpty) summary.pedFilledFresh++
  summary.pedConflicts += lotConflicts.length
  if (lotConflicts.length) {
    allConflicts.push({ lot_number: pdfLot.lot_number, name: pdfLot.name, conflicts: lotConflicts })
  }

  // maternal_line: altijd vullen als nu null; bestaand → laten staan + log
  let newMl = dbLot.maternal_line
  if (dbLot.maternal_line == null) {
    newMl = pdfLot.maternal_line
    summary.mlFilled++
  } else {
    summary.mlAlready++
  }

  if (onlyLot != null && commit === false) {
    console.log(`--- lot ${pdfLot.lot_number} ${pdfLot.name} ---`)
    console.log('  pedigree was leeg?:', wasEmpty)
    console.log('  conflicts:', lotConflicts.length)
    if (lotConflicts.length) for (const c of lotConflicts) console.log('    ·', c.path, 'DB="' + c.db + '" PDF="' + c.pdf + '"')
    console.log('  resulting pedigree.sire.name:', newPed?.sire?.name)
    console.log('  resulting pedigree.dam.name:', newPed?.dam?.name)
    console.log('  maternal_line filled?:', dbLot.maternal_line == null)
    console.log('  ml.1 (eerste 80):', (newMl?.['1'] || '').slice(0, 80))
  }

  if (commit) {
    const { error: upErr } = await sb
      .from('lots')
      .update({ pedigree: newPed, maternal_line: newMl })
      .eq('id', dbLot.id)
    if (upErr) {
      console.error(`❌ lot ${pdfLot.lot_number} update mislukt:`, upErr)
      continue
    }
    summary.written++
    if (!onlyLot) process.stdout.write('.')
  }
}
if (commit && !onlyLot) console.log()

// ─── Conflict-rapport ──────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)
const reportPath = commit
  ? path.resolve('reports', `${today}_fences-pdf-merge-conflicten.md`)
  : path.resolve('/tmp', `${today}_fences-pdf-merge-conflicten-DRYRUN.md`)

await mkdir(path.dirname(reportPath), { recursive: true })

const lines = []
lines.push(`# Fences PDF-merge conflict-rapport`)
lines.push(``)
lines.push(`- Datum: ${today}`)
lines.push(`- Bron: ${jsonPath}`)
lines.push(`- Doel-collectie: ${COLLECTION_ID}`)
lines.push(`- Mode: ${commit ? 'COMMIT (DB geschreven)' : 'DRY-RUN (geen DB-writes)'}`)
lines.push(``)
lines.push(`## Samenvatting`)
lines.push(``)
lines.push(`| Metriek | Aantal |`)
lines.push(`|---|---|`)
lines.push(`| Lots in PDF | ${pdfLots.length} |`)
lines.push(`| Gematched op nummer | ${summary.matched} |`)
lines.push(`| Geen DB-match | ${summary.missing} |`)
lines.push(`| Naam-verschil (zelfde nummer) | ${summary.namesMismatch} |`)
lines.push(`| Pedigree was leeg → volledig gevuld | ${summary.pedFilledFresh} |`)
lines.push(`| Pedigree-knoop-conflicten (DB behouden) | ${summary.pedConflicts} |`)
lines.push(`| Maternal_line was leeg → gevuld | ${summary.mlFilled} |`)
lines.push(`| Maternal_line bestond al → behouden | ${summary.mlAlready} |`)
if (commit) lines.push(`| Lots werkelijk weggeschreven | ${summary.written} |`)
lines.push(``)

if (allConflicts.length === 0) {
  lines.push(`## Conflicten`)
  lines.push(``)
  lines.push(`Geen. Alle PDF-data kon zonder DB te overschrijven worden toegevoegd.`)
} else {
  lines.push(`## Conflicten per lot`)
  lines.push(``)
  lines.push(`Bij elk conflict is de DB-waarde behouden; de PDF-versie staat`)
  lines.push(`hier ter info zodat Frederik kan beslissen of hij handmatig wil`)
  lines.push(`overschrijven.`)
  lines.push(``)
  for (const c of allConflicts) {
    lines.push(`### Lot ${c.lot_number} — ${c.name}`)
    lines.push(``)
    lines.push(`| Pad | DB (behouden) | PDF (afgewezen) |`)
    lines.push(`|---|---|---|`)
    for (const x of c.conflicts) {
      lines.push(`| \`${x.path}\` | ${x.db || '_(leeg)_'} | ${x.pdf || '_(leeg)_'} |`)
    }
    lines.push(``)
  }
}

await writeFile(reportPath, lines.join('\n'))

console.log()
console.log(`✓ Klaar. Samenvatting:`)
for (const [k, v] of Object.entries(summary)) console.log(`  - ${k}: ${v}`)
console.log()
console.log(`📄 Rapport: ${reportPath}`)
if (!commit) console.log(`💡 Voeg --commit toe om de DB werkelijk te updaten.`)
