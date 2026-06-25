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
// (pedigreeUrl per lot uit /api/Items/<id>). Hippomundo zit achter Cloudflare,
// maar een ÉCHTE browser (Puppeteer) lost de challenge op en de boom rendert.
// We navigeren rechtstreeks naar de embed-URL (same-origin → uitleesbaar),
// lossen Cloudflare één keer op (cookie blijft hangen → daarna snel), en parsen
// de bracket op geometrie naar onze pedigree-jsonb { sire/dam met 3 generaties }.
// Zo krijgen we ook de ÉCHTE moeder (pedigree.dam.name). De Hippomundo-link
// blijft bewaard in url_hippomundo. Lukt de boom niet → fallback op de
// "Vader X Moedersvader"-regel uit de beschrijving (vader + moedersvader).
//
// Schrijft data/weauction-<slug>.json (zelfde meta+horses[]-formaat als de
// andere scrapers); daarna importeert scripts/import-lots.mjs dat.
//
// Gebruik:
//   node scripts/scrape-weauction-api.mjs <auction-url> <house-name> [collection-name]
// Voorbeeld:
//   node scripts/scrape-weauction-api.mjs \
//     "https://bid.thecollection-auction.com/auctions/<id>" "The Collection" "The Collection Live 2026"

import puppeteer from 'puppeteer'
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

// FALLBACK als de Hippomundo-boom niet lukt: eerste regel van de beschrijving =
// "Vader X Moedersvader" (shorthand). Vader (deel 1) + moedersvader (deel 2) →
// minimale pedigree-jsonb { sire:{name}, dam:{ sire:{name} } }. De moeder zelf
// blijft dan leeg (die staat enkel in de Hippomundo-stamboom).
function pedigreeFromDescription(desc) {
  if (!desc) return { sire: null, pedigree_raw: null, pedigree: null }
  const firstLine = desc.split('\n')[0].replace(/\r/g, '').trim()
  const m = firstLine.match(/^(.+?)\s+[x×]\s+(.+)$/i)
  if (!m) return { sire: null, pedigree_raw: firstLine || null, pedigree: null }
  const sire = m[1].trim()
  const damsire = m[2].trim()
  const pedigree = { sire: { name: sire }, dam: { sire: { name: damsire } } }
  return { sire, pedigree_raw: firstLine, pedigree }
}

// ── Hippomundo 3-generatie-stamboom (via Puppeteer) ──────────────────────────
// De bracket is een visuele layout; we parsen op GEOMETRIE: cluster de
// naam-vakjes in kolommen (x), en wijs kinderen toe aan hun dichtstbijzijnde
// ouder (y) — boven = sire, onder = dam. Robuust tegen ontbrekende voorouders.
function hippoAncestorBoxes(boxes) {
  return boxes.filter((b) =>
    b.y < 240 &&                       // enkel de boom-region (prozatekst staat lager)
    /[A-Za-z]/.test(b.name) &&
    !/^\(/.test(b.name) &&             // "(Cumano)" e.d. zijn annotaties, geen voorouders
    !/^xx\s*:/i.test(b.name) &&
    !/^level\b/i.test(b.name) &&
    !/etc/i.test(b.name) &&
    !/black type/i.test(b.name) &&
    !/:$/.test(b.name) &&
    !/^(HLR|HR|HD|OS|SF|KWPN|BWP)\b/.test(b.name) &&
    !/^\d/.test(b.name))
}

function hippoClusterByX(boxes) {
  const sorted = [...boxes].sort((a, b) => a.x - b.x)
  const cols = []
  for (const b of sorted) {
    const last = cols[cols.length - 1]
    if (last && Math.abs(b.x - last.x) < 120) last.items.push(b)
    else cols.push({ x: b.x, items: [b] })
  }
  return cols
}

function hippoAssign(children, parents) {
  const map = new Map(parents.map((p) => [p, []]))
  for (const c of children) {
    let best = parents[0], bd = Infinity
    for (const p of parents) { const d = Math.abs(c.y - p.y); if (d < bd) { bd = d; best = p } }
    map.get(best).push(c)
  }
  for (const arr of map.values()) arr.sort((a, b) => a.y - b.y)
  return map
}

function parseHippoPedigree(boxes) {
  const cols = hippoClusterByX(hippoAncestorBoxes(boxes))
  if (cols.length < 4) return null
  // cols[0]=subject, [1]=ouders, [2]=grootouders, [3]=overgrootouders
  const parents = [...cols[1].items].sort((a, b) => a.y - b.y)
  if (parents.length < 2) return null
  const gpByParent = hippoAssign(cols[2].items, parents)
  const ggpByGp = hippoAssign(cols[3].items, cols[2].items)
  const gpNode = (gpBox) => {
    if (!gpBox) return null
    const kids = ggpByGp.get(gpBox) || []
    return { name: gpBox.name, sire: kids[0] ? { name: kids[0].name } : null, dam: kids[1] ? { name: kids[1].name } : null }
  }
  const parentNode = (pBox) => {
    if (!pBox) return null
    const kids = gpByParent.get(pBox) || []
    return { name: pBox.name, sire: gpNode(kids[0]), dam: gpNode(kids[1]) }
  }
  return { sire: parentNode(parents[0]), dam: parentNode(parents[1]) }
}

// Haal één Hippomundo-pedigree op via een (gedeelde) Puppeteer-page.
// Pollt tot de boom ÉCHT parseerbaar is (Cloudflare voorbij + bracket gerenderd)
// i.p.v. een vaste wachttijd — robuust tegen wisselende laadtijden.
async function fetchHippoPedigree(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const collect = () => page.evaluate(() => {
    const out = []
    document.querySelectorAll('*').forEach((el) => {
      const direct = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean).join(' ')
      if (!direct || direct.length > 40) return
      const r = el.getBoundingClientRect()
      if (r.width < 15 || r.height < 6) return
      out.push({ name: direct, x: Math.round(r.x), y: Math.round(r.y) })
    })
    return out
  })
  let last = null
  for (let i = 0; i < 25; i++) { // max ~25s; stopt zodra de boom compleet is
    await new Promise((r) => setTimeout(r, 1000))
    const ped = parseHippoPedigree(await collect())
    last = ped || last
    if (ped && ped.sire?.name && ped.dam?.name) return ped // ouders gevuld → klaar
  }
  return last
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
  // Afstamming: volledige Hippomundo-boom als die opgehaald is, anders de
  // "Vader X Moedersvader"-regel uit de beschrijving als fallback.
  const desc = pedigreeFromDescription(item.description)
  const tree = item._pedigree || null
  const pedigree = tree || desc.pedigree
  const sire = tree?.sire?.name || desc.sire || null
  const dam = tree?.dam?.name || null            // de ÉCHTE moeder (enkel uit de boom)
  const pedigree_raw = desc.pedigree_raw

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
    !dam && 'dam',
    !pedigree && 'pedigree',
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
    dam,
    pedigree_raw,
    pedigree,
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
// Stap 1: per lot de Hippomundo-link ophalen (één detail-call).
let linked = 0
for (let i = 0; i < raw.length; i++) {
  const id = raw[i].id
  if (!id) continue
  try {
    const r = await fetch(`${ORIGIN}/api/Items/${encodeURIComponent(id)}`, { headers: UA })
    if (r.ok) {
      const detail = await r.json()
      if (detail?.pedigreeUrl) { raw[i].pedigreeUrl = detail.pedigreeUrl; linked++ }
    }
  } catch { /* link is optioneel */ }
  await new Promise((res) => setTimeout(res, 120)) // nette pauze
}
console.log(`   ✓ ${linked}/${raw.length} Hippomundo-links opgehaald`)

// Stap 2: per lot de volledige 3-generatie-stamboom ophalen via Puppeteer.
// Eén gedeelde browser: de eerste navigatie lost Cloudflare op, de cookie
// blijft hangen → de rest gaat snel. Mislukt een boom → fallback (beschrijving).
const withLink = raw.filter((it) => it.pedigreeUrl)
if (withLink.length) {
  console.log(`   ⏳ stambomen ophalen (Hippomundo, ${withLink.length} lots)…`)
  let treeOk = 0, done = 0
  for (let i = 0; i < raw.length; i++) {
    if (!raw[i].pedigreeUrl) continue
    done++
    // Verse browser per lot: na de eerste Cloudflare-clearance escaleert de
    // challenge voor volgende navigaties binnen dezelfde browser. Een verse
    // browser per lot lost dat op (bewezen). Kleine pauze ertussen = netjes.
    const browser = await puppeteer.launch({ headless: 'new' })
    try {
      const pg = await browser.newPage()
      await pg.setUserAgent(UA['User-Agent'])
      await pg.setViewport({ width: 1280, height: 1400 })
      const ped = await fetchHippoPedigree(pg, raw[i].pedigreeUrl)
      if (ped && (ped.sire || ped.dam)) {
        raw[i]._pedigree = ped; treeOk++
        process.stdout.write(`   [${done}/${withLink.length}] ${raw[i].name?.slice(0, 30)} → ${ped.sire?.name || '?'} × ${ped.dam?.name || '?'}\n`)
      } else {
        process.stdout.write(`   [${done}/${withLink.length}] ${raw[i].name?.slice(0, 30)} → geen boom (fallback)\n`)
      }
    } catch (e) { process.stdout.write(`   [${done}/${withLink.length}] fout: ${e.message}\n`) }
    finally { await browser.close() }
    await new Promise((r) => setTimeout(r, 800))
  }
  console.log(`   ✓ ${treeOk}/${withLink.length} volledige stambomen geparseerd`)
}

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
