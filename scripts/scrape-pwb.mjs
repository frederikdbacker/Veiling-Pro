// PWB-platform scraper (white-label CMS: horseauctionbelgium.com,
// paardenveilingonline.com — beide /collectie/{id}).
//
// De volledige collectie staat als .card-collection-kaarten op de
// collectiepagina; er is GEEN per-paard detailpagina. De afstamming staat
// enkel als "Vader x Moedervader" op de kaart (1 generatie). De scheidings-
// "x" is GETAGD (<small><b>x</b></small> óf <span class="text-secondary">x
// </span>) en verschilt per white-label — daarom splitsen op het getagde
// element, niet op een kale "x" (anders breekt "Nixon").
//
// Schrijft data/pwb-{host}-{id}.json; daarna laadt scripts/import-lots.mjs
// dit in Supabase (die leidt lot_type_id zelf af).
//
// Gebruik:
//   node scripts/scrape-pwb.mjs <collectie-url>
// Voorbeelden:
//   node scripts/scrape-pwb.mjs https://horseauctionbelgium.com/collectie/41
//   node scripts/scrape-pwb.mjs https://paardenveilingonline.com/collectie/56

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const URL_ARG = process.argv[2]
if (!URL_ARG || !/\/collectie\/\d+/.test(URL_ARG)) {
  console.error('Usage: node scripts/scrape-pwb.mjs <collectie-url>')
  console.error('Example: node scripts/scrape-pwb.mjs https://horseauctionbelgium.com/collectie/41')
  process.exit(1)
}

const u = new URL(URL_ARG)
const ORIGIN = u.origin
const COLL_ID = (u.pathname.match(/\/collectie\/(\d+)/) || [])[1]

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; veiling-pro-scraper)' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.text()
}

function decodeEntities(s) {
  if (!s) return s
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
}

function clean(s) {
  if (!s) return null
  return decodeEntities(String(s).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() || null
}

// Ruwe inner-HTML van het element met class `cls` (p, h1-6 of div).
function rawField(seg, cls) {
  const m = new RegExp(
    `<(p|h[1-6]|div)[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1>`, 'i'
  ).exec(seg)
  return m ? m[2] : null
}
const field = (seg, cls) => clean(rawField(seg, cls))

// Splits op de GETAGDE x; val terug op " x " mét spaties (nooit kale x,
// anders breekt "Nixon van 't Meulenhof").
function sireDam(rawHtml) {
  if (!rawHtml) return { sire: null, dam: null }
  const parts = rawHtml.split(/<(small|span|b|strong)[^>]*>\s*[x×]\s*<\/\1>/i)
  if (parts.length >= 3) {
    return { sire: clean(parts[0]), dam: clean(parts[parts.length - 1]) }
  }
  const t = clean(rawHtml) || ''
  const m = t.split(/\s+[x×]\s+/)
  return { sire: (m[0] || '').trim() || null, dam: (m[1] || '').trim() || null }
}

const GENDERS = /\b(merrie|hengst|ruin|stallion|mare|gelding|colt|filly|stute|wallach)\b/i

const html = await fetchHtml(URL_ARG)

const pageTitle = clean((/<meta property="og:title" content="([^"]+)"/.exec(html)
  || /<title>([^<]+)<\/title>/.exec(html) || [])[1])
const siteName = clean((/<meta property="og:site_name" content="([^"]+)"/.exec(html) || [])[1])
const collTitle = (pageTitle || `PWB collectie ${COLL_ID}`).split('|')[0].trim()
const houseName = siteName
  || (u.hostname.includes('horseauctionbelgium') ? 'Horse Auction Belgium' : 'Paardenveilingonline')

const segments = html.split(/class="[^"]*card-collection[^"]*"/i).slice(1)
const horses = []
for (const seg of segments) {
  const nameRaw = field(seg, 'horsename') || ''
  const nm = /^\s*(\d+)\s*[.)]\s*(.+)$/.exec(nameRaw)
  const lot_number = nm ? Number(nm[1]) : null
  const name = (nm ? nm[2] : nameRaw).trim() || null
  if (!name) continue

  const { sire, dam } = sireDam(rawField(seg, 'horsepedigree'))
  const info = field(seg, 'horseinfo') || ''
  const yearM = /[°˚∘]?\s*(\d{4})/.exec(info)
  const year = yearM ? Number(yearM[1]) : null
  const gender = (GENDERS.exec(info) || [])[1] || null
  const imgM = /<img[^>]+src="([^"]+)"[^>]*class="[^"]*card-img/i.exec(seg)
  const img = imgM ? decodeEntities(imgM[1]) : null

  horses.push({
    lot_number,
    name,
    discipline: null,
    year,
    gender,
    size: null,
    studbook: null,
    sire,
    dam,
    pedigree: (sire || dam)
      ? { sire: sire ? { name: sire, sire: null, dam: null } : null,
          dam: dam ? { name: dam, sire: null, dam: null } : null }
      : null,
    pedigree_raw: [sire, dam].filter(Boolean).join(' x ') || null,
    catalog_text: field(seg, 'horseslogan'),
    photos: img ? [new URL(img, ORIGIN).href] : [],
    video_url: null,
    source_url: URL_ARG,
    starting_bid: null,
  })
}

horses.sort((a, b) => {
  if (a.lot_number != null && b.lot_number != null) return a.lot_number - b.lot_number
  if (a.lot_number != null) return -1
  if (b.lot_number != null) return 1
  return (a.name ?? '').localeCompare(b.name ?? '', 'nl')
})

console.log(`✅ Scraped ${horses.length} horses (${houseName})`)

const output = {
  meta: {
    collection: collTitle,
    house: houseName,
    website: ORIGIN,
    location: 'Online',
    status: 'planned',
    imported_at: new Date().toISOString(),
    total: horses.length,
    data_source: `PWB-scraper, ${u.hostname}/collectie/${COLL_ID}`,
  },
  horses,
}

const outPath = `data/pwb-${u.hostname.split('.')[0]}-${COLL_ID}.json`
await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, JSON.stringify(output, null, 2))
console.log(`💾 Wrote ${outPath}`)
console.log(`\nNext: node --env-file=.env.local scripts/import-lots.mjs ${outPath}`)
