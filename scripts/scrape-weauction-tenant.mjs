// Scrape ALLE auctions van een weauction.nl tenant.
// Gebruikt het /api/auctions/publishedByTenant endpoint (gesnift via
// Puppeteer omdat het tenant-context vereist) om alle auction UUIDs op te
// halen, en draait daarna scrape-weauction.mjs per auction.
//
// Gebruik:
//   node scripts/scrape-weauction-tenant.mjs <base-url> <house-name>
// Voorbeeld:
//   node scripts/scrape-weauction-tenant.mjs https://bid.wefsporthorseauction.com "WEF Sporthorse Auction powered by VDL Stud"

import puppeteer from 'puppeteer'
import { spawnSync } from 'node:child_process'

const BASE = process.argv[2]?.replace(/\/$/, '')
const HOUSE = process.argv[3]
if (!BASE || !HOUSE) {
  console.error('Usage: node scripts/scrape-weauction-tenant.mjs <base-url> <house-name>')
  process.exit(1)
}

console.log(`📥 Fetching auction list from ${BASE}…`)
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()

let auctionsData = null
page.on('response', async (resp) => {
  if (resp.url().includes('/api/auctions/publishedByTenant')) {
    try { auctionsData = await resp.json() } catch {}
  }
})

await page.goto(`${BASE}/auctions`, { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise((r) => setTimeout(r, 2500))
await browser.close()

if (!auctionsData?.data) {
  console.error('❌ Geen auction-list ontvangen via API')
  process.exit(1)
}

const all = auctionsData.data
console.log(`📋 ${all.length} auctions found:`)
const usable = all.filter((a) => a.itemsCount > 0)
for (const a of all) {
  const skipMark = a.itemsCount === 0 ? '⏭️ ' : '  '
  console.log(`  ${skipMark}${a.id} | ${a.name} | items=${a.itemsCount} | ${a.startDateTime?.slice(0,10)}`)
}
console.log(`\n→ ${usable.length} met lots, ga scrapen…`)

const results = []
for (let i = 0; i < usable.length; i++) {
  const a = usable[i]
  const url = `${BASE}/auctions/${a.id}`
  console.log(`\n━━━ [${i + 1}/${usable.length}] ${a.name} ━━━`)
  const r = spawnSync('node', ['scripts/scrape-weauction.mjs', url, HOUSE, a.name], {
    stdio: 'inherit',
  })
  if (r.status !== 0) {
    console.warn(`  ⚠ scrape failed for ${a.name}`)
    results.push({ name: a.name, ok: false })
  } else {
    results.push({ name: a.name, ok: true, jsonHint: a.name })
  }
}

console.log(`\n\n🎯 Klaar — ${results.filter((r) => r.ok).length}/${results.length} OK`)
console.log('\nVolgende stap: importeer alle data/weauction-*.json bestanden:')
console.log('  for f in data/weauction-*.json; do node --env-file=.env.local scripts/import-lots.mjs "$f"; done')
