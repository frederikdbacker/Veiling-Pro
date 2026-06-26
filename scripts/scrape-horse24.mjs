// HORSE24-platform scraper (verdener-auktion-online.com, *.horse24.com).
//
// De HORSE24-sites zijn Vue-apps die hun data server-side meegeven als JSON in
// component-props (:auction / :lots / :lot / :pedigrees). De parsing zit in de
// bewezen lib scripts/lib/horse24.mjs (scrapeCollection); dit script is enkel de
// standalone wrapper in de vorm van de andere scrape-*.mjs: het mapt de
// teruggave naar het meta + horses[]-formaat dat scripts/import-lots.mjs inleest.
//
// Gebruik:
//   node scripts/scrape-horse24.mjs <auction-url> <house-name> [collection-name]
// Voorbeeld:
//   node scripts/scrape-horse24.mjs \
//     'https://verdener-auktion-online.com/de/auctions/details/39-verdener-auktion-online-fohlen-137' \
//     'Hannoveraner Verband'

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { scrapeCollection } from './lib/horse24.mjs'

const AUCTION_URL = process.argv[2]
const HOUSE = process.argv[3]
const COLL_NAME = process.argv[4]

if (!AUCTION_URL || !HOUSE) {
  console.error('Usage: node scripts/scrape-horse24.mjs <auction-url> <house-name> [collection-name]')
  process.exit(1)
}

function slugify(s) {
  return (s || '').toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

console.log(`📥 HORSE24: ${AUCTION_URL}`)
let result
try {
  result = await scrapeCollection(AUCTION_URL, {
    onProgress: ({ done, total, name }) => process.stdout.write(`\r  verrijken ${done}/${total} — ${(name || '').slice(0, 30)}        `),
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
    collection: (COLL_NAME || m.auction || 'HORSE24 collectie').trim(),
    house: HOUSE,
    house_country: 'Duitsland',
    website: m.website,
    date: m.date || null,
    location: 'Online',
    status,
    notes: m.description || null,
    imported_at: new Date().toISOString(),
    total: horses.length,
    data_source: `HORSE24-scraper, ${m.source_url}`,
  },
  horses,
}

const slug = slugify(m.slug || `${m.auction || 'horse24'}-${m.system_auction_id || ''}`) || 'horse24'
const outPath = `data/horse24-${slug}.json`
await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, JSON.stringify(output, null, 2))
console.log(`✅ Scraped ${horses.length} horses (${output.meta.house})`)
console.log(`💾 Wrote ${outPath}`)
console.log(`\nNext: node --env-file=.env.local scripts/import-lots.mjs ${outPath}`)
