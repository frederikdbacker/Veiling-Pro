// Scraper voor een aankomende Fences-veiling-catalogus (bv. SELECTION).
//
// Leest de catalogus-pagina /cheval/vente/<slug>/, volgt elke paard-detail-
// pagina /cheval/<slug>/<naam>/<id>/ en parseert per paard: lotnummer, naam,
// vader (Père), moeder (Mère), moedersvader (Père de Mère), geslacht, studbook,
// geboortejaar (uit Âge) en foto's.
//
// Keuze: lots.dam = Mère (de moeder), zoals de SERVICE-import. De moedersvader
// (Père de Mère) wordt apart als `damsire` bewaard.
//
// GUARD voor onbewaakt draaien — komt een pagina niet als 200 terug, of mist ze
// 'Père :'/'Mère :' (leeg/geblokkeerd), dan STOPT de run, logt de reden en
// schrijft GEEN lege paarden weg. Liever N goede + foutmelding dan half-lege
// records. Exit-code 2 = onvolledig.
//
// Gebruik:
//   node scripts/scrape-fences-catalogus.mjs <vente-slug> [auctionYear]
//   node scripts/scrape-fences-catalogus.mjs selection 2026

import { writeFile, mkdir } from 'node:fs/promises'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) veiling-pro-scraper'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const venteSlug = process.argv[2]
const auctionYear = parseInt(process.argv[3] || '2026', 10)
if (!venteSlug) {
  console.error('Usage: node scripts/scrape-fences-catalogus.mjs <vente-slug> [year]')
  process.exit(1)
}
const CATALOG = `https://www.fences.fr/cheval/vente/${venteSlug}/`

function normalize(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
}
function genderToNL(s) {
  const v = (s || '').toLowerCase()
  if (v.includes('femelle') || v.includes('jument')) return 'merrie'
  if (v.includes('hongre')) return 'ruin'
  if (v.includes('mâle') || v.includes('male') || v.includes('étalon') || v.includes('etalon')) return 'hengst'
  return null
}
function field(text, label) {
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*([^\\n]+)')
  const m = text.match(re)
  return m ? m[1].trim() : null
}
async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  return { ok: res.ok, status: res.status, html: await res.text() }
}

// 1. Catalogus → detail-URL's
console.log(`📖 Catalogus: ${CATALOG}`)
const cat = await fetchHtml(CATALOG)
if (!cat.ok) { console.error(`❌ STOP: catalogus gaf HTTP ${cat.status}`); process.exit(1) }
const urlRe = new RegExp(`https://www\\.fences\\.fr/cheval/${venteSlug}/[a-z0-9-]+/\\d+`, 'gi')
const detailUrls = [...new Set(cat.html.match(urlRe) || [])]
console.log(`   ${detailUrls.length} paard-links gevonden`)
if (detailUrls.length === 0) {
  console.error('❌ STOP: geen paard-links op de catalogus (leeg/geblokkeerd?)')
  process.exit(2)
}

// 2. Detailpagina's — met guard
const horses = []
let stopped = null
for (let i = 0; i < detailUrls.length; i++) {
  const url = detailUrls[i]
  let r
  try { r = await fetchHtml(url) }
  catch (e) { stopped = `fetch-fout bij ${url}: ${e.message}`; break }
  if (!r.ok) { stopped = `HTTP ${r.status} bij ${url}`; break }

  const text = normalize(r.html)
  if (!/Père\s*:/.test(text) || !/Mère\s*:/.test(text)) {
    stopped = `pagina leeg/geblokkeerd (geen Père/Mère) bij ${url}`
    break
  }

  const id = (url.match(/\/(\d+)$/) || [])[1] || null
  const head = text.match(/(\d+)\.\s+([^\n]+?)\s*\n\s*Père\s*:/)
  const lot_number = head ? parseInt(head[1], 10) : null
  const name = head ? head[2].trim() : null
  const sire = field(text, 'Père')
  const dam = field(text, 'Mère')              // dam = Mère (de moeder)
  const damsire = field(text, 'Père de Mère')
  const sexe = field(text, 'Sexe')
  const studbook = field(text, 'Studbook')
  const ageM = text.match(/Âge\s*:\s*(\d+)\s*an/)
  const year = ageM ? auctionYear - parseInt(ageM[1], 10) : null
  const photos = [...new Set(
    r.html.match(/https:\/\/extranetfences\.com\/upload\/ged\/[^\s"')]+\.(?:jpg|jpeg|png)/gi) || []
  )]

  if (!name || !sire) { stopped = `kernvelden ontbreken (naam/Père) bij ${url}`; break }

  horses.push({
    fences_id: id, lot_number, name,
    slug: (url.match(new RegExp(`cheval/${venteSlug}/([a-z0-9-]+)/\\d+`, 'i')) || [])[1] || null,
    discipline: 'Springen',
    year, gender: genderToNL(sexe), studbook,
    sire, dam, damsire,
    photos,
    source_url: url,
  })
  console.log(`   ✓ ${String(i + 1).padStart(2)}/${detailUrls.length}  lot ${lot_number ?? '?'} · ${name}`)
  await sleep(600)
}

// 3. Wegschrijven — enkel de goede paarden
await mkdir('data', { recursive: true })
const outPath = `data/fences-${venteSlug}-${auctionYear}-import.json`
await writeFile(outPath, JSON.stringify({
  meta: {
    house: 'Agence Fences',
    vente: venteSlug,
    auctionYear,
    data_source: CATALOG,
    scraped_at: new Date().toISOString(),
    expected: detailUrls.length,
    scraped: horses.length,
    stopped_reason: stopped,
  },
  horses,
}, null, 2))

if (stopped) {
  console.error(`\n⚠️  GESTOPT: ${stopped}`)
  console.error(`   ${horses.length}/${detailUrls.length} goede paarden weggeschreven → ${outPath}`)
  console.error('   Geen lege records weggeschreven. Run NIET als compleet beschouwen.')
  process.exit(2)
}
console.log(`\n💾 ${horses.length}/${detailUrls.length} paarden → ${outPath}`)
