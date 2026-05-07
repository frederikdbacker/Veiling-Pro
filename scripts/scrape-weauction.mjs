// Generieke scraper voor het weauction.nl SPA-platform.
// Werkt voor: bid.aloga-auction.com, bid.wefsporthorseauction.com,
// woodlandsinternational.weauction.nl, swbauction.swb.org,
// bid.dewoldensummersale.com en andere instances.
//
// Gebruikt Puppeteer omdat de site een Angular SPA is — de lots staan
// niet in de initiële HTML.
//
// Gebruik:
//   node scripts/scrape-weauction.mjs <auction-url> <house-name> [collection-name]
// Voorbeeld:
//   node scripts/scrape-weauction.mjs "https://bid.aloga-auction.com/auctions/98423791-..." "Aloga"

import puppeteer from 'puppeteer'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const AUCTION_URL = process.argv[2]
const HOUSE = process.argv[3]
const COLL_NAME = process.argv[4]

if (!AUCTION_URL || !HOUSE) {
  console.error('Usage: node scripts/scrape-weauction.mjs <auction-url> <house-name> [collection-name]')
  process.exit(1)
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })

console.log(`📥 ${AUCTION_URL}`)
await page.goto(AUCTION_URL, { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise((r) => setTimeout(r, 2500))

// Scroll om lazy-loaded items te triggeren
await page.evaluate(async () => {
  await new Promise((resolve) => {
    let h = 0
    const t = setInterval(() => {
      window.scrollBy(0, 600); h += 600
      if (h >= document.body.scrollHeight) { clearInterval(t); resolve() }
    }, 200)
  })
})
await new Promise((r) => setTimeout(r, 3000))

const result = await page.evaluate(() => {
  const auctionTitle = document.querySelector('h2')?.textContent.trim()
                       || document.querySelector('h1')?.textContent.trim()
                       || document.title

  // Item-panels — elk een lot. NB: app-item-overview wraps .item-panel —
  // alleen één van beide selecteren, anders krijgen we elk lot dubbel.
  const panels = [...document.querySelectorAll('.item-panel')]
  const lots = []

  for (const panel of panels) {
    const name = panel.querySelector('.item-overview-name, h4')?.textContent.trim()
    if (!name || name.length > 80) continue

    const subtitle = panel.querySelector('.item-overview-subtitle, h5')?.textContent.trim() || null
    const description = panel.querySelector('.item-overview-description, p')?.textContent.trim() || null
    const imgs = [...panel.querySelectorAll('img')]
      .map((i) => i.src)
      .filter((u) => u.startsWith('http') && !u.includes('logo') && !u.includes('flag'))

    lots.push({ name, subtitle, description, imgs })
  }

  return { auctionTitle, lots }
})

await browser.close()
console.log(`📋 Found ${result.lots.length} lots`)

function genderToNL(value) {
  if (!value) return null
  const v = value.toLowerCase()
  if (v.includes('mare') || v.includes('merrie'))            return 'merrie'
  if (v.includes('stallion') || v.includes('hengst') || v.includes('colt')) return 'hengst'
  if (v.includes('gelding') || v.includes('ruin'))           return 'ruin'
  return null
}

function parseSubtitle(s) {
  // Patroon: "2019 I Mare I Vingino x Diarado"
  // Separator is een stand-alone "I" (of "|", "·", "•") omringd door whitespace.
  // BELANGRIJK: zonder \s+ rondom matchen we ook de letter I in "Vingino" / "Diarado".
  if (!s) return { year: null, gender: null, sire: null, dam: null }
  const parts = s.split(/\s+(?:I|\||·|•)\s+/).map((p) => p.trim()).filter(Boolean)
  let year = null, gender = null, sire = null, dam = null
  for (const p of parts) {
    if (!year) {
      const m = p.match(/^(\d{4})$/)
      if (m) { year = parseInt(m[1], 10); continue }
    }
    if (!gender) {
      const g = genderToNL(p)
      if (g) { gender = g; continue }
    }
    // Sire x Dam pattern
    const x = p.match(/^(.+?)\s+[x×]\s+(.+)$/i)
    if (x && !sire) {
      sire = x[1].trim()
      dam  = x[2].trim()
      continue
    }
  }
  return { year, gender, sire, dam }
}

function slugify(name) {
  return (name || '').toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const horses = result.lots.map((lot) => {
  const meta = parseSubtitle(lot.subtitle)
  return {
    name: lot.name,
    slug: slugify(lot.name),
    discipline: 'Springen',
    year: meta.year,
    gender: meta.gender,
    size: null,
    studbook: null,
    sire: meta.sire,
    dam: meta.dam,
    photos: [...new Set(lot.imgs)].slice(0, 6),
    video_url: null,
    source_url: AUCTION_URL,
    catalog_text: lot.description?.slice(0, 2000) || null,
    starting_bid: null,
  }
})

const collectionName = COLL_NAME || result.auctionTitle || 'Onbekende collectie'

const output = {
  meta: {
    collection: collectionName,
    house: HOUSE,
    website: new URL(AUCTION_URL).origin,
    status: 'afgesloten',
    imported_at: new Date().toISOString(),
    total: horses.length,
    data_source: `weauction-scraper (Puppeteer), ${AUCTION_URL}`,
  },
  horses,
}

const slug = slugify(`${HOUSE}-${collectionName}`)
const outPath = `data/weauction-${slug}.json`
await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, JSON.stringify(output, null, 2))
console.log(`💾 Wrote ${outPath}`)
console.log(`\nNext: node --env-file=.env.local scripts/import-lots.mjs ${outPath}`)
