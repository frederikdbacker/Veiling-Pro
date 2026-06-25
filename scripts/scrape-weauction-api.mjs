// Scraper voor de NIEUWE weauction-frontend (Tailwind, o.a. The Collection —
// bid.thecollection-auction.com). APART van scrape-weauction.mjs, dat de OUDE
// Angular-frontend (.item-panel, o.a. Aloga/WEF) afhandelt en bewust
// ongewijzigd blijft.
//
// Deze frontend levert een schone JSON-API:
//   GET <origin>/api/auctions/<auctionId>/Items/published?Page=1&PageSize=200
//   → { page, pageSize, totalRecords, currentRecords, data: [ …items… ] }
// Eén (gepagineerde) call geeft alle lots met volledige data. Geen browser nodig.
//
// Afstamming: de volledige 3-generatie-stamboom is een Hippomundo-embed
// (Cloudflare-protected, niet scrapebaar). We bewaren de Hippomundo-link per lot
// (url_hippomundo → de echte stamboom, 1 klik weg) en de VADER uit de
// "Vader X Moedersvader"-regel in de beschrijving; de moeder blijft leeg (die
// regel toont de moedersvader, niet de moeder) en wordt in missing_info gezet.
//
// Schrijft data/weauction-<slug>.json (zelfde meta+horses[]-formaat als de
// andere scrapers); daarna importeert scripts/import-lots.mjs dat.
//
// Gebruik:
//   node scripts/scrape-weauction-api.mjs <auction-url> <house-name> [collection-name]
// Voorbeeld:
//   node scripts/scrape-weauction-api.mjs \
//     "https://bid.thecollection-auction.com/auctions/<id>" "The Collection" "The Collection Live 2026"

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const AUCTION_URL = process.argv[2]
const HOUSE = process.argv[3]
const COLL_NAME = process.argv[4]

if (!AUCTION_URL || !HOUSE) {
  console.error('Usage: node scripts/scrape-weauction-api.mjs <auction-url> <house-name> [collection-name]')
  process.exit(1)
}

const ORIGIN = new URL(AUCTION_URL).origin
const AUCTION_ID = (AUCTION_URL.match(/\/auctions\/([^/?#]+)/i) || [])[1] || null
const BLOB_BASE = 'https://weauction.blob.core.windows.net'
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }

if (!AUCTION_ID) {
  console.error(`❌ Kon het auction-id niet uit de URL halen: ${AUCTION_URL}`)
  process.exit(1)
}

// ── helpers ──────────────────────────────────────────────────────────────────
function genderToNL(value) {
  if (!value) return null
  const v = value.toLowerCase()
  if (/\b(mare|merrie|filly|jument)\b/.test(v)) return 'Merrie'
  if (/\b(stallion|hengst|colt|etalon|étalon)\b/.test(v)) return 'Hengst'
  if (/\b(gelding|ruin|wallach|hongre)\b/.test(v)) return 'Ruin'
  return null
}

function slugify(name) {
  return (name || '').toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Subtitle is rommelig en wisselend: "BAI - MARE - 2018 - SIZE : M",
// "Chestnut - Gelding - 2019 - Size: M", "BAI - MARE- 2019 - SIZE: L",
// " Mare - 2019 - Size: M". Daarom op PATROON parsen, niet op positie.
function parseSubtitle(s) {
  if (!s) return { year: null, gender: null, size: null }
  const yearM = s.match(/\b(19|20)\d{2}\b/)
  const year = yearM ? parseInt(yearM[0], 10) : null
  const gender = genderToNL(s)
  const sizeM = s.match(/size\s*:?\s*([SMLsml])\b/i)
  const size = sizeM ? sizeM[1].toUpperCase() : null
  return { year, gender, size }
}

// Eerste regel van de beschrijving = "Vader X Moedersvader" (shorthand). We
// nemen enkel de VADER zeker over; deel 2 is de moedersvader, niet de moeder.
function sireFromDescription(desc) {
  if (!desc) return { sire: null, pedigree_raw: null }
  const firstLine = desc.split('\n')[0].replace(/\r/g, '').trim()
  const m = firstLine.match(/^(.+?)\s+[x×]\s+(.+)$/i)
  if (!m) return { sire: null, pedigree_raw: null }
  return { sire: m[1].trim(), pedigree_raw: firstLine }
}

function fullImageUrl(imagePath) {
  if (!imagePath) return null
  if (/^https?:\/\//i.test(imagePath)) return imagePath
  return BLOB_BASE + (imagePath.startsWith('/') ? '' : '/') + imagePath
}

function mapItem(item) {
  // Lotnummer = de "N."-prefix in de naam (het echte catalogusnummer dat
  // bieders zien). item.orderNumber is een interne sorteersleutel met gaten en
  // is NIET het catalogusnummer — enkel als fallback gebruiken.
  const numMatch = (item.name || '').match(/^\s*(\d+)\.\s*/)
  const lotNumber = numMatch ? parseInt(numMatch[1], 10) : (item.orderNumber ?? null)
  const name = (item.name || '').replace(/^\s*\d+\.\s*/, '').trim() || (item.name || '').trim()
  const { year, gender, size } = parseSubtitle(item.subtitle)
  const { sire, pedigree_raw } = sireFromDescription(item.description)

  // Foto's: hoofdfoto + itemMedias met mediaType 0 (afbeeldingen).
  const photoSet = new Set()
  const main = fullImageUrl(item.image?.imagePath)
  if (main) photoSet.add(main)
  for (const m of item.itemMedias || []) {
    if (m.mediaType === 0 && m.imagePath) {
      const u = fullImageUrl(m.imagePath)
      if (u) photoSet.add(u)
    }
  }
  // Video: eerste youtube-embed (mediaType 1).
  let video_url = null
  for (const m of item.itemMedias || []) {
    if (m.mediaType === 1 && m.videoUrl) {
      const yt = m.videoUrl.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/)
      video_url = yt ? `https://www.youtube.com/watch?v=${yt[1]}` : m.videoUrl.replace(/^\/\//, 'https://')
      break
    }
  }

  const missing = [
    !sire && 'sire',
    'dam', // moeder zit enkel in de Hippomundo-embed (Cloudflare) / prozatekst
    !item.startingAmount && 'starting_bid',
    photoSet.size === 0 && 'photos',
  ].filter(Boolean)

  return {
    lot_number: lotNumber,
    name,
    slug: slugify(name),
    discipline: 'Springen',
    year,
    gender,
    size,
    studbook: null,
    sire,
    dam: null,
    pedigree_raw,
    photos: [...photoSet].slice(0, 8),
    video_url,
    source_url: AUCTION_URL,
    url_hippomundo: item.pedigreeUrl || null,
    catalog_text: item.description ? item.description.replace(/\r/g, '').trim().slice(0, 4000) : null,
    starting_bid: item.startingAmount || null,
    data_reliability: 'scraped',
    missing_info: missing,
    _startTime: item.startTime || null,
  }
}

// ── ophalen via de API (gepagineerd) ─────────────────────────────────────────
console.log(`📥 ${AUCTION_URL}`)
const pageSize = 200
let page = 1
let raw = []
let title = null
while (true) {
  const apiUrl = `${ORIGIN}/api/auctions/${encodeURIComponent(AUCTION_ID)}/Items/published?Page=${page}&PageSize=${pageSize}&ShowDeleted=false`
  const res = await fetch(apiUrl, { headers: UA })
  if (!res.ok) {
    console.error(`❌ API gaf HTTP ${res.status} ${res.statusText} — ${apiUrl}`)
    console.error('   Mogelijk draait deze tenant nog de oude frontend → gebruik scrape-weauction.mjs.')
    process.exit(1)
  }
  const json = await res.json()
  const data = Array.isArray(json?.data) ? json.data : null
  if (!data) { console.error('❌ Onverwacht API-antwoord (geen data[]).'); process.exit(1) }
  if (data.length && !title) title = data[0].auctionName || null
  raw = raw.concat(data)
  const total = json.totalRecords ?? raw.length
  console.log(`   pagina ${page}: ${data.length} (totaal ${raw.length}/${total})`)
  if (raw.length >= total || data.length === 0) break
  page++
  if (page > 50) break // veiligheidsplafond
}

// De lijst-API geeft pedigreeUrl: null — die staat enkel op /api/Items/<id>.
// Verrijk per lot met één detail-call (Hippomundo-stamboomlink). Faalt een
// call → gewoon zonder link verder (niet fataal).
let enriched = 0
for (let i = 0; i < raw.length; i++) {
  const id = raw[i].id
  if (!id) continue
  try {
    const r = await fetch(`${ORIGIN}/api/Items/${encodeURIComponent(id)}`, { headers: UA })
    if (r.ok) {
      const detail = await r.json()
      if (detail?.pedigreeUrl) { raw[i].pedigreeUrl = detail.pedigreeUrl; enriched++ }
    }
  } catch { /* link is optioneel */ }
  await new Promise((res) => setTimeout(res, 120)) // nette pauze
}
console.log(`   ✓ ${enriched}/${raw.length} pedigree-links opgehaald`)

const horses = raw.map(mapItem)
console.log(`📋 Found ${horses.length} lots`)

// HARDE check: geen lots → fout (nooit stil een lege catalogus importeren).
if (!horses.length) {
  console.error('❌ Geen lots gevonden — afgebroken, geen lege import.')
  process.exit(1)
}

// Verkoopdatum + status uit de eerste startTime.
const startTime = horses.map((h) => h._startTime).find(Boolean) || null
let saleDate = null
if (startTime) { const d = startTime.slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) saleDate = d }
const status = startTime ? (new Date(startTime).getTime() > Date.now() ? 'planned' : 'afgesloten') : 'planned'
horses.forEach((h) => delete h._startTime)

const collectionName = COLL_NAME || title || 'Onbekende collectie'

const output = {
  meta: {
    collection: collectionName,
    house: HOUSE,
    website: ORIGIN,
    status,
    imported_at: new Date().toISOString(),
    total: horses.length,
    data_source: `weauction-api-scraper, ${AUCTION_URL}`,
  },
  horses,
}
if (saleDate) output.meta.date = saleDate

const slug = slugify(`${HOUSE}-${collectionName}`)
const outPath = `data/weauction-${slug}.json`
await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, JSON.stringify(output, null, 2))
console.log(`💾 Wrote ${outPath}`)
console.log(`\nNext: node --env-file=.env.local scripts/import-lots.mjs ${outPath}`)
