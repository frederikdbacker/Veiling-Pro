// Verdeel de lots van een (meerdaagse) Fences-collectie over veilingdagen op
// basis van de "ordre de passage" (doorkomstvolgorde) — migratie 0031.
//
// ACHTERGROND (zie docs/plan-meerdaagse-collectie-opsplitsing.md, sectie A & C.2):
// De gescrapete catalogus bevat GÉÉN dag-veld (één catalogus-URL voor alle
// dagen). De échte dag-indeling staat in de laat-gepubliceerde "ordre de
// passage" (/<vente>-ordre-de-passage/), met een eigen volgnummer. Die pagina
// gaf op 23 juni 2026 nog HTTP 500. Daarom werkt dit script in twee modi:
//
//   1. PROBE  — kijk of de ordre-de-passage-pagina al online staat:
//        node scripts/scrape-fences-ordre-passage.mjs --probe <url>
//
//   2. ASSIGN — verdeel lots over dagen vanuit een JSON-bestand met de
//      doorkomstvolgorde per dag (handmatig of gescrapet opgesteld):
//        node --env-file=.env.local scripts/scrape-fences-ordre-passage.mjs \
//          <passage.json> [collectie-naamdeel] [--dry-run] [--set-order]
//
// JSON-vorm (passage.json):
//   {
//     "collection_name_match": "élection",        // optioneel (anders argv)
//     "days": [
//       { "day_index": 1, "date": "2026-06-29",
//         "lots": [ { "source_url": "...", "slug": "...", "name": "Caïd",
//                     "passage": 1 }, ... ] },
//       { "day_index": 2, "date": "2026-06-30", "lots": [ ... ] }
//     ]
//   }
//
// MATCHING: per passage-lot zoeken we ons lot via stabiele sleutel, in volgorde
// source_url → slug → naam (case-insensitive). Onbekende dag-info raakt nooit
// een lot kwijt; alle mismatches worden gelogd.
//
// AUDIT (projectregel): de ordre de passage is de gezaghebbende bron en mag de
// dag-verdeling OVERSCHRIJVEN, maar elke verschuiving (lot stond op dag X, gaat
// naar dag Y) wordt expliciet geLOGD. --dry-run toont alles zonder te schrijven.

import { readFile } from 'node:fs/promises'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) veiling-pro-scraper'

// ---- PROBE-modus -----------------------------------------------------------
if (process.argv[2] === '--probe') {
  const url = process.argv[3]
  if (!url) { console.error('Usage: --probe <url>'); process.exit(1) }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    console.log(`HTTP ${res.status} ${res.statusText} — ${url}`)
    if (res.ok) {
      const html = await res.text()
      console.log(`✅ Pagina is online (${html.length} bytes). Klaar om te parsen ` +
                  `wanneer het paginaformaat bekend is.`)
    } else {
      console.log('⏳ Nog niet beschikbaar — probeer dichter bij het event opnieuw.')
    }
  } catch (e) {
    console.error(`❌ Fetch-fout: ${e.message}`)
  }
  process.exit(0)
}

// ---- ASSIGN-modus ----------------------------------------------------------
import { createClient } from '@supabase/supabase-js'
import { ensureDays } from './lib/days.mjs'

const file = process.argv[2]
const flags = process.argv.slice(3).filter((a) => a.startsWith('--'))
const positional = process.argv.slice(3).filter((a) => !a.startsWith('--'))
const nameMatchArg = positional[0]
const dryRun = flags.includes('--dry-run')
const setOrder = flags.includes('--set-order')

if (!file) {
  console.error('Usage: node --env-file=.env.local scripts/scrape-fences-ordre-passage.mjs <passage.json> [naamdeel] [--dry-run] [--set-order]')
  console.error('   of: node scripts/scrape-fences-ordre-passage.mjs --probe <url>')
  process.exit(1)
}

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) { console.error('❌ Env vars ontbreken (run met --env-file=.env.local).'); process.exit(1) }
const sb = createClient(url, key)

const passage = JSON.parse(await readFile(file, 'utf8'))
const nameMatch = nameMatchArg || passage.collection_name_match
if (!nameMatch) { console.error('❌ Geef een collectie-naamdeel mee (argv of JSON.collection_name_match).'); process.exit(1) }
if (!Array.isArray(passage.days) || passage.days.length === 0) {
  console.error('❌ JSON.days[] ontbreekt of is leeg.'); process.exit(1)
}

// Fences-huis + exact één doelcollectie
const { data: house } = await sb.from('auction_houses').select('id, name').ilike('name', '%fences%').single()
if (!house) { console.error('❌ Fences-huis niet gevonden.'); process.exit(1) }
const { data: colls, error: cErr } = await sb.from('collections')
  .select('id, name').eq('house_id', house.id).ilike('name', `%${nameMatch}%`)
if (cErr) { console.error(cErr.message); process.exit(1) }
if (!colls || colls.length !== 1) {
  console.error(`❌ Verwachtte precies 1 collectie met '${nameMatch}', vond ${colls?.length || 0}.`); process.exit(1)
}
const coll = colls[0]
console.log(`🎯 Collectie: ${coll.name}`)

// Onze lots + stabiele sleutels
const { data: lots, error: lErr } = await sb.from('lots')
  .select('id, number, name, slug, source_url, collection_day_id, auction_order')
  .eq('collection_id', coll.id)
if (lErr) { console.error(lErr.message); process.exit(1) }
console.log(`📋 ${lots.length} lots in de collectie`)

// Indexen voor matching
const byUrl  = new Map(lots.filter((l) => l.source_url).map((l) => [l.source_url, l]))
const bySlug = new Map(lots.filter((l) => l.slug).map((l) => [l.slug, l]))
const byName = new Map(lots.filter((l) => l.name).map((l) => [l.name.trim().toLowerCase(), l]))

function matchLot(entry) {
  if (entry.source_url && byUrl.has(entry.source_url)) return byUrl.get(entry.source_url)
  if (entry.slug && bySlug.has(entry.slug)) return bySlug.get(entry.slug)
  if (entry.name && byName.has(entry.name.trim().toLowerCase())) return byName.get(entry.name.trim().toLowerCase())
  return null
}

// Dagen garanderen (met datums uit de JSON)
const dayDates = passage.days.map((d) => d.date ?? null)
const days = await ensureDays(sb, coll.id, dayDates)
const dayByIndex = new Map(days.map((d) => [d.day_index, d]))

// Verzamel de gewenste toewijzingen
const updates = []          // { lot, dayId, dayIndex, order }
const unmatched = []
for (const day of passage.days) {
  const target = dayByIndex.get(day.day_index)
  if (!target) { console.error(`⚠ Dag ${day.day_index} niet gevonden na ensureDays.`); continue }
  ;(day.lots ?? []).forEach((entry, i) => {
    const lot = matchLot(entry)
    if (!lot) { unmatched.push({ day: day.day_index, entry }); return }
    updates.push({
      lot,
      dayId: target.id,
      dayIndex: day.day_index,
      order: setOrder ? (entry.passage ?? i + 1) : null,
    })
  })
}

// Toepassen + audit
let assigned = 0, shifted = 0, unchanged = 0
for (const u of updates) {
  const cur = u.lot.collection_day_id
  const curIndex = days.find((d) => d.id === cur)?.day_index ?? null
  const patch = {}
  if (cur !== u.dayId) patch.collection_day_id = u.dayId
  if (u.order != null && u.lot.auction_order !== u.order) patch.auction_order = u.order
  if (Object.keys(patch).length === 0) { unchanged++; continue }

  if (cur && cur !== u.dayId) {
    console.log(`  ↪ VERSCHUIVING: #${u.lot.number ?? '—'} ${u.lot.name} — dag ${curIndex} → dag ${u.dayIndex}`)
    shifted++
  } else if (!cur) {
    assigned++
  }

  if (!dryRun) {
    const { error } = await sb.from('lots').update(patch).eq('id', u.lot.id)
    if (error) console.error(`  ❌ ${u.lot.name}: ${error.message}`)
  }
}

console.log('\n— Samenvatting —')
console.log(`${dryRun ? '(DRY-RUN, niets geschreven) ' : ''}` +
            `nieuw toegewezen: ${assigned} · verschoven: ${shifted} · ongewijzigd: ${unchanged}`)
if (unmatched.length > 0) {
  console.log(`⚠ ${unmatched.length} passage-regels zonder match (niet toegewezen):`)
  for (const u of unmatched.slice(0, 30)) {
    console.log(`   dag ${u.day}: ${u.entry.name ?? u.entry.slug ?? u.entry.source_url ?? '???'}`)
  }
  if (unmatched.length > 30) console.log(`   … en nog ${unmatched.length - 30} meer`)
}
console.log(setOrder ? '🔢 auction_order gezet uit passage-volgorde.' : 'ℹ︎ auction_order ongemoeid (gebruik --set-order om de doorkomstvolgorde over te nemen).')
