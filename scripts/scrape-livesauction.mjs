// Generieke scraper voor sites op het "live-auction"-platform (Pweb Solutions).
// Wordt gebruikt door 334 Sporthorse Stud, Woodlands International Sales,
// en mogelijk anderen. Patroon:
//   /live-auction/{id}        — collectie-pagina met lot-links
//   /auction/{slug}            — individuele lot-pagina
//
// Gebruik:
//   node scripts/scrape-livesauction.mjs <base-url> <auction-id> <house-name> [collection-name]
// Voorbeeld:
//   node scripts/scrape-livesauction.mjs https://woodlandsinternational.eu 8 'Woodlands International Sales'
//   node scripts/scrape-livesauction.mjs https://334sporthorsestud.com 3 '334 Auction'

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const BASE = process.argv[2]?.replace(/\/$/, '')
const AUCTION_ID = process.argv[3]
const HOUSE = process.argv[4]
const COLL_NAME = process.argv[5]

if (!BASE || !AUCTION_ID || !HOUSE) {
  console.error('Usage: node scripts/scrape-livesauction.mjs <base-url> <auction-id> <house-name> [collection-name]')
  process.exit(1)
}

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
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() || null
}

function genderToNL(value) {
  if (!value) return null
  const v = value.toLowerCase()
  if (v.includes('hengst') || v === 'stallion' || v === 'colt') return 'hengst'
  if (v.includes('merrie') || v === 'mare' || v === 'filly')    return 'merrie'
  if (v.includes('ruin')   || v === 'gelding')                  return 'ruin'
  return value
}

function parseDateToYear(s) {
  if (!s) return null
  // "07-06-2023" or "2019" or "12-09-2022"
  const ymd = s.match(/(\d{4})/)
  return ymd ? parseInt(ymd[1], 10) : null
}

function parseSize(s) {
  if (!s) return null
  const m = s.match(/(\d{2,3}(?:\.\d)?)\s*cm/i)
  return m ? `${m[1]} cm` : s
}

/**
 * Extract waarde uit <th><b>LABEL</b></th><td>VALUE</td> structure
 * (zoals gebruikt door 334, Woodlands en andere live-auction-platforms).
 */
function extractField(html, label) {
  const re = new RegExp(`<th[^>]*>\\s*<b>\\s*${label}\\s*</b>\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`, 'i')
  const m = html.match(re)
  return clean(m?.[1])
}

function extractFirst(html, regex) {
  const m = html.match(regex)
  return m ? m[1] : null
}

function slugify(name) {
  return (name || '').toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function scrapeLot(relUrl) {
  const url = relUrl.startsWith('http') ? relUrl : BASE + relUrl
  const html = await fetchHtml(url)

  const rawTitle = clean(extractFirst(html, /<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i))
  // Woodlands toont vaak "NAAM - CATNR X" — split af voor lot_number
  let name = rawTitle, lotNumberFromTitle = null
  const catnrMatch = rawTitle?.match(/^(.+?)\s*-\s*CATNR\s*(\d+)\s*$/i)
  if (catnrMatch) {
    name = catnrMatch[1].trim()
    lotNumberFromTitle = parseInt(catnrMatch[2], 10)
  }

  // Sire/Dam soms enkel in URL-slug aanwezig (Woodlands-patroon "NAAM-SIRE-x-DAM")
  let urlSire = null, urlDam = null
  const slugPart = relUrl.split('/').pop() || ''
  const xSplit = slugPart.match(/-([A-Z][A-Z0-9-]+)-x-([A-Z][A-Z0-9-]+)$/i)
  if (xSplit) {
    urlSire = xSplit[1].replace(/-/g, ' ').trim()
    urlDam  = xSplit[2].replace(/-/g, ' ').trim()
  }

  const dob = extractField(html, 'Date of birth') || extractField(html, 'Geboortedatum')
  const year = parseDateToYear(dob)
  const gender = genderToNL(extractField(html, 'Gender') || extractField(html, 'Geslacht'))
  const studbook = extractField(html, 'Studbook') || extractField(html, 'Stamboek')
  const size = parseSize(extractField(html, 'Height') || extractField(html, 'Schofthoogte') || extractField(html, 'Stokmaat'))
  const sire = extractField(html, 'Sire') || extractField(html, 'Vader') || extractField(html, 'Father') || urlSire
  const dam  = extractField(html, 'Dam')  || extractField(html, 'Moeder') || extractField(html, 'Mother') || urlDam
  const color = extractField(html, 'Color') || extractField(html, 'Kleur')

  // Photos: /userfiles/image/...jpg
  const photoMatches = [...html.matchAll(/src="(\/userfiles\/image\/[^"]+\.(?:jpg|jpeg|png))"/gi)]
  const photos = [...new Set(photoMatches.map((m) => BASE + m[1]))]
                  .filter((u) => !u.includes('logo') && !u.includes('flag'))

  // Video: vimeo or youtube embed
  const videoMatch = html.match(/(player\.vimeo\.com\/video\/\d+|youtube\.com\/(?:watch\?v=|embed\/)[a-zA-Z0-9_-]+)/i)
  const video_url = videoMatch ? `https://${videoMatch[1].replace('youtube.com/embed/', 'youtube.com/watch?v=')}` : null

  // Catalog text: zoek <p> blokken na de eerste img
  const descMatch = html.match(/<p[^>]*>([^<]{30,500})<\/p>/i)
  const catalog_text = clean(descMatch?.[1])

  return {
    lot_number: lotNumberFromTitle,
    name,
    slug: slugify(name),
    discipline: 'Springen',
    year,
    gender,
    size,
    studbook,
    sire,
    dam,
    photos,
    video_url,
    source_url: url,
    catalog_text,
    starting_bid: null,
    notes: color ? { catalog: `Kleur: ${color}.` } : null,
  }
}

// ---------------------------------------------------------------------

const collUrl = `${BASE}/live-auction/${AUCTION_ID}`
console.log(`📥 Fetching: ${collUrl}`)
const collHtml = await fetchHtml(collUrl)

const collTitle = COLL_NAME
                  || clean(extractFirst(collHtml, /<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i))
                  || clean(extractFirst(collHtml, /<title>\s*([^|<]+?)\s*[|<]/i))
                  || `${HOUSE} live-auction ${AUCTION_ID}`

// Lot URLs: /auction/{slug}
const lotUrls = [...new Set(
  [...collHtml.matchAll(/href="(\/auction\/[^"\s#?]+)"/g)].map((m) => m[1])
)]

console.log(`📋 Found ${lotUrls.length} lots`)

const horses = []
for (let i = 0; i < lotUrls.length; i++) {
  process.stdout.write(`\r  scraping ${i + 1}/${lotUrls.length}…`)
  try {
    const horse = await scrapeLot(lotUrls[i])
    if (horse.name) horses.push(horse)
  } catch (e) {
    console.warn(`\n  ⚠ ${lotUrls[i]} — ${e.message}`)
  }
}
console.log(`\n✅ Scraped ${horses.length} horses`)

const output = {
  meta: {
    collection: collTitle,
    house: HOUSE,
    website: BASE,
    status: 'afgesloten',
    imported_at: new Date().toISOString(),
    total: horses.length,
    data_source: `livesauction-scraper, base=${BASE}, id=${AUCTION_ID}`,
  },
  horses,
}

const slug = slugify(`${HOUSE}-${AUCTION_ID}-${collTitle ?? ''}`)
const outPath = `data/livesauction-${slug}.json`
await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, JSON.stringify(output, null, 2))
console.log(`💾 Wrote ${outPath}`)
console.log(`\nNext: node --env-file=.env.local scripts/import-lots.mjs ${outPath}`)
