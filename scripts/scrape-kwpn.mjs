// KWPN-veiling-platform scraper (kwpn.auction) — standalone wrapper.
//
// kwpn.auction draait op de Pweb/Media-Primair-familie (verwant aan 334 /
// Woodlands), maar de lot-detail-markup wijkt wezenlijk af → eigen scraper.
// De parsing zit in de lib scripts/lib/kwpn.mjs (scrapeCollection); dit script
// is enkel de standalone wrapper in de vorm van de andere scrape-*.mjs: het mapt
// de teruggave naar het meta + horses[]-formaat dat scripts/import-lots.mjs inleest.
//
// Gebruik:
//   node scripts/scrape-kwpn.mjs <base-url> <auction-id> <house-name> [collection-name]
// Voorbeeld:
//   node scripts/scrape-kwpn.mjs https://kwpn.auction 303 'KWPN'

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { scrapeCollection } from './lib/kwpn.mjs'

const BASE = process.argv[2]?.replace(/\/$/, '')
const AUCTION_ID = process.argv[3]
const HOUSE = process.argv[4]
const COLL_NAME = process.argv[5]

if (!BASE || !AUCTION_ID || !HOUSE) {
  console.error('Usage: node scripts/scrape-kwpn.mjs <base-url> <auction-id> <house-name> [collection-name]')
  process.exit(1)
}

function slugify(s) {
  return (s || '').toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

console.log(`📥 KWPN: ${BASE}/live-veiling/${AUCTION_ID}`)
let result
try {
  result = await scrapeCollection(BASE, AUCTION_ID, {
    onProgress: ({ done, total, name }) => process.stdout.write(`\r  scraping ${done}/${total} — ${(name || '').slice(0, 32)}        `),
  })
} catch (e) {
  console.error(`\n❌ Scrapen mislukt: ${e.message}`)
  process.exit(1)
}
const { meta: m, horses } = result
console.log(`\n📋 ${horses.length} lots`)

// HARDE check: geen lots → fout (nooit stil een lege catalogus importeren).
if (!horses.length) {
  console.error('❌ Geen lots gevonden — afgebroken, geen lege import.')
  process.exit(1)
}

// Status afleiden uit de datum (toekomst = gepland, anders afgesloten).
const today = new Date().toISOString().slice(0, 10)
const status = m.date && m.date >= today ? 'planned' : 'afgesloten'

const output = {
  meta: {
    collection: (COLL_NAME || m.auction || 'KWPN collectie').trim(),
    house: HOUSE,
    house_country: 'Nederland',
    website: m.website,
    date: m.date || null,
    location: 'Online',
    status,
    imported_at: new Date().toISOString(),
    total: horses.length,
    data_source: `kwpn-scraper, base=${BASE}, id=${AUCTION_ID}`,
  },
  horses,
}

const slug = slugify(m.slug || `kwpn-${AUCTION_ID}`) || 'kwpn'
const outPath = `data/kwpn-${slug}.json`
await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, JSON.stringify(output, null, 2))
console.log(`✅ Scraped ${horses.length} horses (${output.meta.house})`)
console.log(`💾 Wrote ${outPath}`)
console.log(`\nNext: node --env-file=.env.local scripts/import-lots.mjs ${outPath}`)
