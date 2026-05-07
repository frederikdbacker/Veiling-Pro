// Starsale-specifieke scraper.
//
// Starsale heeft per jaar een overzicht: /veulens/starsale-veulenoverzicht-{year}
// dat alle lots van dat jaar lijst. Lot-URLs hebben patroon
// /veulens/{year}/{lotnr}-{slug}.
//
// Gebruik:
//   node scripts/scrape-starsale.mjs <year>
// Voorbeeld:
//   node scripts/scrape-starsale.mjs 2025

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const BASE = 'https://www.starsaleauctions.com'
const YEAR = process.argv[2]

if (!YEAR || !/^\d{4}$/.test(YEAR)) {
  console.error('Usage: node scripts/scrape-starsale.mjs <year>')
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
  if (v.includes('hengst')) return 'hengst'
  if (v.includes('merrie')) return 'merrie'
  if (v.includes('ruin'))   return 'ruin'
  return value
}

function disciplineToNL(value) {
  if (!value) return null
  const v = value.toLowerCase()
  if (v.includes('spring')) return 'Springen'
  if (v.includes('dressuur') || v.includes('dressage')) return 'Dressuur'
  return value
}

function parseDate(ddmmyyyy) {
  if (!ddmmyyyy) return null
  const m = ddmmyyyy.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (!m) return null
  let [_, dd, mm, yyyy] = m
  if (yyyy.length === 2) yyyy = '20' + yyyy
  return parseInt(yyyy, 10)
}

/** Parse `<table class="tekst">` met label/value-rijen */
function extractTekstFields(html) {
  const tableMatch = html.match(/<table class="tekst">([\s\S]*?)<\/table>/i)
  if (!tableMatch) return {}
  const rows = [...tableMatch[1].matchAll(/<tr>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)]
  const out = {}
  for (const r of rows) {
    out[clean(r[1])] = clean(r[2])
  }
  return out
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

async function scrapeLot(relUrl, name, lotNumber) {
  const url = relUrl.startsWith('http') ? relUrl : BASE + relUrl
  const html = await fetchHtml(url)

  const f = extractTekstFields(html)

  // Afstamming: "SIRE x DAM"
  let sire = null, dam = null
  if (f['Afstamming']) {
    const parts = f['Afstamming'].split(/\s*x\s*/i)
    sire = parts[0]?.trim() || null
    dam  = parts.slice(1).join(' x ').trim() || null
  }

  // Eerste moeder uit extra-table
  const firstMoeder = extractFirst(html, /1e moeder:\s*([^<]+)</i)
  if (!dam && firstMoeder) dam = clean(firstMoeder)

  // Photos via /storage/veulens/{year}/{n}{a|b|c|d}.jpg pattern
  const photoMatches = [...html.matchAll(new RegExp(`src="(https?:[^"]+/storage/veulens/${YEAR}/${lotNumber}[a-z]?[^"]*\\.(?:jpg|jpeg|png))"`, 'gi'))]
  const photos = [...new Set(photoMatches.map((m) => m[1].replace(':443/', '/').replace(/_thumb/, '')))]

  // YouTube video
  const videoMatch = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/)
  const video_url = videoMatch ? `https://www.youtube.com/watch?v=${videoMatch[1]}` : null

  return {
    lot_number: lotNumber ? parseInt(lotNumber, 10) : null,
    name,
    slug: slugify(name),
    discipline: disciplineToNL(f['Fokrichting']),
    year: parseDate(f['Geboortedatum']),
    gender: genderToNL(f['Geslacht']),
    size: null, // veulens hebben geen schofthoogte
    studbook: null, // niet expliciet vermeld op pagina
    sire,
    dam,
    photos,
    video_url,
    source_url: url,
    catalog_text: f['Kleur'] ? `Kleur: ${f['Kleur']}.${f['Fokker'] ? ` Fokker: ${f['Fokker']}.` : ''}` : null,
    starting_bid: null,
  }
}

// ---------------------------------------------------------------------

const overviewSlug = `starsale-veulenoverzicht-${YEAR}`
const overviewUrl = `${BASE}/veulens/${overviewSlug}`
console.log(`📥 Fetching: ${overviewUrl}`)
const overviewHtml = await fetchHtml(overviewUrl)

const collTitle = clean(extractFirst(overviewHtml, /<h2[^>]*>\s*([^<]*starsale[^<]*)<\/h2>/i))
                 || `Starsale Veulenoverzicht ${YEAR}`

// Extract lot URLs (and lot number + name uit URL)
const lotRegex = new RegExp(`href="(https?:[^"]+\\/veulens\\/${YEAR}\\/(\\d+)-([a-z0-9-]+))"`, 'gi')
const lotEntries = [...new Set(
  [...overviewHtml.matchAll(lotRegex)].map((m) => {
    const url = m[1].replace(':443/', '/')
    const number = m[2]
    const slug = m[3]
    const name = slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    return JSON.stringify({ url, number, name })
  })
)].map((s) => JSON.parse(s))

console.log(`📋 Found ${lotEntries.length} lots`)

const horses = []
for (let i = 0; i < lotEntries.length; i++) {
  const e = lotEntries[i]
  process.stdout.write(`\r  scraping ${i + 1}/${lotEntries.length}…`)
  try {
    const horse = await scrapeLot(e.url, e.name, e.number)
    horses.push(horse)
  } catch (err) {
    console.warn(`\n  ⚠ ${e.url} — ${err.message}`)
  }
}
console.log(`\n✅ Scraped ${horses.length} horses`)

horses.sort((a, b) => (a.lot_number ?? 0) - (b.lot_number ?? 0))

const output = {
  meta: {
    collection: collTitle,
    house: 'Starsale Auction',
    house_country: 'Nederland',
    website: 'https://www.starsaleauctions.com',
    date: `${YEAR}-08-01`, // Starsale-veulenveilingen typisch in augustus
    location: 'Online',
    status: 'afgesloten',
    imported_at: new Date().toISOString(),
    total: horses.length,
    data_source: `Starsale-scraper, year=${YEAR}`,
  },
  horses,
}

const outPath = `data/starsale-${YEAR}.json`
await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, JSON.stringify(output, null, 2))
console.log(`💾 Wrote ${outPath}`)
console.log(`\nNext: node --env-file=.env.local scripts/import-lots.mjs ${outPath}`)
