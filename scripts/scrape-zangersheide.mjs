// Zangersheide-specifieke scraper.
//
// Haalt een collectie + alle lots op van zangersheide.com en schrijft
// het resultaat als JSON in data/zangersheide-{slug}.json. Daarna kan
// scripts/import-lots.mjs dit JSON in Supabase laden.
//
// Gebruik:
//   node scripts/scrape-zangersheide.mjs <collection-slug>
// Voorbeeld:
//   node scripts/scrape-zangersheide.mjs zangersheide-stallion-auction-2026
//
// De slug komt uit de URL: https://www.zangersheide.com/nl/auctions/<slug>

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import puppeteer from 'puppeteer'

const BASE = 'https://www.zangersheide.com'
const SLUG = process.argv[2]

if (!SLUG) {
  console.error('Usage: node scripts/scrape-zangersheide.mjs <collection-slug>')
  console.error('Example: node scripts/scrape-zangersheide.mjs zangersheide-stallion-auction-2026')
  process.exit(1)
}

// ── Transport via een ECHTE browser (Puppeteer) ──────────────────────────────
// zangersheide.com staat achter Cloudflare: een kale fetch geeft 403 (ook de
// homepage). Een echte browser passeert de challenge. GEVERIFIEERD: een tweede
// navigatie in DEZELFDE browsersessie wordt door Cloudflare hard geblokkeerd
// ("Attention Required"), maar een VERSE incognito-context per pagina komt er
// wél langs — en is veel lichter dan een volledige browser-relaunch per lot
// (belangrijk bij grote foals-veilingen, 50-100 lots). Eén gedeeld browser-
// proces; per pagina een verse context; bij een Cloudflare-blok retryen (en als
// laatste redmiddel een volledige relaunch, bewezen).
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const POLL_SECONDS = 25
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isCloudflareBlock = (html) => /Attention Required! \| Cloudflare|cdn-cgi\/styles\/cf\.errors/i.test(html)

let browser = null
async function getBrowser() {
  if (!browser) browser = await puppeteer.launch({ headless: 'new' })
  return browser
}
async function newContext(b) {
  return b.createBrowserContext ? b.createBrowserContext() : b.createIncognitoBrowserContext()
}

/** Render één URL en poll tot de echte inhoud er staat (Cloudflare voorbij). */
async function renderPage(page, url, ready) {
  await page.setUserAgent(UA)
  await page.setViewport({ width: 1280, height: 1400 })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  let html = ''
  for (let i = 0; i < POLL_SECONDS; i++) {
    await sleep(1000)
    html = await page.content().catch(() => '')
    if (!isCloudflareBlock(html) && ready(html)) return { html, blocked: false }
  }
  return { html, blocked: isCloudflareBlock(html) }
}

async function renderInContext(url, ready) {
  const ctx = await newContext(await getBrowser())
  try { return await renderPage(await ctx.newPage(), url, ready) }
  finally { await ctx.close().catch(() => {}) }
}

async function renderInFreshBrowser(url, ready) {
  const b = await puppeteer.launch({ headless: 'new' })
  try { return await renderPage(await b.newPage(), url, ready) }
  finally { await b.close().catch(() => {}) }
}

/**
 * Haal de gerenderde HTML van een pagina op. `ready(html)` bepaalt wanneer de
 * echte inhoud geladen is. Onderscheidt een Cloudflare-blok van een échte 0:
 * bij een blok → retry met een verse context (en daarna één volledige relaunch),
 * NOOIT stil als leeg behandelen.
 */
async function fetchHtml(url, ready = () => true) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { html, blocked } = await renderInContext(url, ready)
    if (!blocked && ready(html)) return html
    await sleep(1200 * attempt) // pauze tegen rate-limiting vóór de retry
  }
  // laatste redmiddel: volledige relaunch (bewezen Cloudflare-aanpak)
  const { html, blocked } = await renderInFreshBrowser(url, ready)
  if (!blocked && ready(html)) return html
  throw new Error(`Cloudflare bleef blokkeren (verse contexts + relaunch) — ${url}`)
}

/**
 * Extract de waarde uit een label/value-paar zoals dit op de site staat:
 *   <p class="typo-h5 typo-normal text-skin-base">LABEL</p>
 *   <p class="typo-p typo-normal my-2 text-skin-secondary">VALUE</p>
 */
function decodeEntities(s) {
  if (!s) return s
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function clean(s) {
  if (!s) return null
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() || null
}

function extractField(html, label) {
  const re = new RegExp(
    `<p[^>]*typo-h5[^>]*text-skin-base[^>]*>\\s*${label}\\s*</p>\\s*<p[^>]*typo-p[^>]*>([\\s\\S]*?)</p>`,
    'i'
  )
  const m = html.match(re)
  return m ? clean(m[1]) : null
}

function extractFirst(html, regex) {
  const m = html.match(regex)
  return m ? m[1].trim() : null
}

function genderToNL(value) {
  if (!value) return null
  const v = value.toLowerCase()
  if (v.includes('hengst') || v === 'stallion') return 'hengst'
  if (v.includes('merrie') || v === 'mare')     return 'merrie'
  if (v.includes('ruin')   || v === 'gelding')  return 'ruin'
  return value
}

function parseDate(ddmmyyyy) {
  if (!ddmmyyyy) return null
  const m = ddmmyyyy.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (!m) return null
  let [_, dd, mm, yyyy] = m
  if (yyyy.length === 2) yyyy = '20' + yyyy
  return parseInt(yyyy, 10)
}

function parseSize(stokmaat) {
  if (!stokmaat) return null
  const m = stokmaat.match(/(\d{2,3})\s*(cm)?/)
  return m ? `${m[1]} cm` : stokmaat
}

function parseStartPrice(html) {
  // <p class="typo-price typo-normal">€ 54.000,00</p>
  const m = html.match(/typo-price[^>]*>([\s\S]*?)<\/p>/i)
  if (!m) return null
  const text = m[1].replace(/<[^>]+>/g, '').trim()
  const num = text.replace(/[^\d,]/g, '').replace(',', '.')
  const n = parseFloat(num)
  return Number.isFinite(n) ? Math.round(n) : null
}

function parsePhotos(html) {
  // src="/uploads/media/portrait_medium/.../...png" → make absolute, dedupe folder-versions
  const re = /src="(\/uploads\/media\/[^"]+)"/g
  const set = new Set()
  let m
  while ((m = re.exec(html)) !== null) {
    // Normalize: strip ?v=... query and dedupe by base name
    const url = m[1].split('?')[0]
    set.add(BASE + url)
  }
  return [...set].slice(0, 8) // cap to 8 photos
}

function parseVideo(html) {
  // YouTube link in href or iframe
  const m = html.match(/href="(https?:\/\/(?:youtu\.be|www\.youtube\.com)[^"]+)"/i)
                 || html.match(/src="(https?:\/\/(?:www\.youtube\.com|player\.vimeo\.com)[^"]+)"/i)
  return m ? m[1] : null
}

function slugify(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ---------------------------------------------------------------------

async function scrapeLotPage(relUrl) {
  const url = relUrl.startsWith('http') ? relUrl : BASE + relUrl
  const html = await fetchHtml(url, (h) => /typo-h1/.test(h))

  // Extract h1 (horse name) — locate position so we can search after it
  const h1Match = html.match(/<h1[^>]*typo-h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)
  const name = clean(h1Match?.[1])

  // Pedigree-regel staat in een <span class="text-skin-base block"> direct
  // na de h1. Zoek na de h1-positie zodat we niet het navigatie-menu pakken.
  let sire = null, dam = null
  if (h1Match) {
    const afterH1 = html.slice(html.indexOf(h1Match[0]) + h1Match[0].length)
    const sireDamMatch = afterH1.match(/<span[^>]*text-skin-base[^>]*block[^>]*>\s*<span[^>]*typo-h5[^>]*>\s*([^<]+?)\s*<\/span>/i)
    if (sireDamMatch) {
      const sireDam = clean(sireDamMatch[1]) ?? ''
      const parts = sireDam.split(' - ')
      sire = parts[0]?.trim() || null
      dam  = parts.slice(1).join(' - ').trim() || null
    }
  }

  const lotNoText = extractFirst(html, /Lot\s*#\s*(\d+)/i)
  const year = parseDate(extractField(html, 'Geboortedatum'))
  const size = parseSize(extractField(html, 'Stokmaat'))
  const studbook = extractField(html, 'Stamboek')
  const gender = genderToNL(extractField(html, 'Geslacht'))

  // Discipline staat soms in een "Doel"-veld, soms in beschrijving
  const discipline = extractField(html, 'Discipline') || extractField(html, 'Doel') || 'Springen'

  // Catalog-tekst — h4 onder de pedigree-regel
  const catalogText = clean(extractFirst(html, /<h4[^>]*typo-h4[^>]*text-skin-secondary-alt[^>]*>\s*([\s\S]*?)\s*<\/h4>/i))

  return {
    lot_number: lotNoText ? parseInt(lotNoText, 10) : null,
    name,
    slug: slugify(name),
    discipline,
    year,
    gender,
    size,
    studbook,
    sire,
    dam,
    photos: parsePhotos(html),
    video_url: parseVideo(html),
    source_url: url,
    catalog_text: catalogText,
    starting_bid: parseStartPrice(html),
  }
}

// ---------------------------------------------------------------------

console.log(`📥 Fetching collection page: ${BASE}/nl/auctions/${SLUG}`)
const collectionHtml = await fetchHtml(`${BASE}/nl/auctions/${SLUG}`, (h) => h.includes(`/nl/auctions/${SLUG}/`))

// Extract collection-naam uit eerste h1, fallback naar <title>
const rawTitle = clean(extractFirst(collectionHtml, /<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i))
                 || clean(extractFirst(collectionHtml, /<title>\s*([^|<]+?)\s*[|<]/i))
                 || SLUG
const collDate  = extractFirst(collectionHtml, /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{2,4}/)
                  || extractFirst(collectionHtml, /(\d{1,2}\/\d{1,2}\/\d{2,4})/)
const dateISO   = (() => {
  if (!collDate) return null
  const m = collDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (!m) return null
  let [_, dd, mm, yyyy] = m
  if (yyyy.length === 2) yyyy = '20' + yyyy
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
})()

// Normaliseer collectie-naam — voeg jaar toe als h1 het niet bevat.
// Zorgt dat meerdere edities van dezelfde serie unieke namen krijgen
// die compatibel zijn met de UNIQUE (house_id, name) constraint.
const collTitle = (() => {
  if (!rawTitle) return SLUG
  const year = dateISO?.slice(0, 4)
  if (year && !rawTitle.match(/\b20\d{2}\b/)) {
    return `${rawTitle} ${year}`
  }
  return rawTitle
})()

// Extract lot-URLs
const lotPathRe = new RegExp(`href="(/nl/auctions/${SLUG}/[^"\\s#?]+)"`, 'g')
const lotUrls = [...new Set(
  [...collectionHtml.matchAll(lotPathRe)].map((m) => m[1])
)]

console.log(`📋 Found ${lotUrls.length} lots`)

// HARDE check: de collectiepagina rendert (anders had fetchHtml gegooid), maar
// 0 lot-links = écht leeg of gewijzigde markup → afbreken, geen lege scrape.
if (lotUrls.length === 0) {
  await browser?.close().catch(() => {})
  console.error('❌ Geen lot-URLs op de collectiepagina — afgebroken (geen lege import).')
  process.exit(1)
}

const horses = []
for (let i = 0; i < lotUrls.length; i++) {
  const url = lotUrls[i]
  if (i > 0) await sleep(600) // kleine pauze tussen lots — netjes tegen rate-limiting
  process.stdout.write(`\r  scraping ${i + 1}/${lotUrls.length}…`)
  try {
    const horse = await scrapeLotPage(url)
    horses.push(horse)
  } catch (e) {
    console.warn(`\n  ⚠ ${url} — ${e.message}`)
  }
}
console.log(`\n✅ Scraped ${horses.length} horses`)

// HARDE check: geen enkel lot gelukt → fout (nooit stil een lege catalogus importeren).
if (horses.length === 0) {
  await browser?.close().catch(() => {})
  console.error('❌ 0 lots opgehaald (alle lot-pagina\'s faalden) — afgebroken, geen lege import.')
  process.exit(1)
}

// Sort by lot_number waar gegeven
horses.sort((a, b) => {
  if (a.lot_number != null && b.lot_number != null) return a.lot_number - b.lot_number
  if (a.lot_number != null) return -1
  if (b.lot_number != null) return 1
  return (a.name ?? '').localeCompare(b.name ?? '', 'nl')
})

const output = {
  meta: {
    collection: collTitle,
    house: 'Zangersheide',
    house_country: 'België',
    website: 'https://www.zangersheide.com',
    date: dateISO,
    location: 'Online & Live',
    status: 'afgesloten',
    imported_at: new Date().toISOString(),
    total: horses.length,
    data_source: `Zangersheide-scraper, slug=${SLUG}`,
  },
  horses,
}

await browser?.close().catch(() => {})

const outPath = `data/zangersheide-${SLUG}.json`
await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, JSON.stringify(output, null, 2))
console.log(`💾 Wrote ${outPath}`)
console.log(`\nNext: node --env-file=.env.local scripts/import-lots.mjs ${outPath}`)
