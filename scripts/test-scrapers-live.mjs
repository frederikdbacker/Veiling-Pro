// Live regressietest voor de scrapers — vangt "stil 0 lots" af.
//
// Draaien (op de Mac mini — netwerk + Chromium + Cloudflare):
//   node scripts/test-scrapers-live.mjs           snel: weauction via API-listing-telling
//   node scripts/test-scrapers-live.mjs --deep    ook de VOLLEDIGE weauction-scrape (incl. Hippomundo)
//
// Per fixture: (1) controleer dat de registry de URL naar de verwachte scraper
// routeert; (2) verifieer dat er lots zijn. Voor weauction gebeurt (2) GOEDKOOP
// via de JSON-API-listing (geen per-lot Hippomundo — anders duurt het minuten).
// Andere scrapers draaien scrape-only en we tellen de horses in hun output.
// Print een ✅/❌/⏭-tabel en eindigt met exit-code ≠ 0 als één fixture 0 lots of
// een fout geeft (skips tellen niet mee). Nieuw weggeschreven data/*.json wordt
// na afloop opgeruimd.

import { analyzeUrl } from '../src/lib/scraperRegistry.js'
import { spawn } from 'node:child_process'
import { readFile, writeFile, readdir, unlink, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEEP = process.argv.includes('--deep')
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
const PER_FIXTURE_TIMEOUT_MS = 8 * 60 * 1000

// ── fixtures: per registry-key een representatieve, recente auction-URL ───────
// mode 'api'    → weauction-tenant; goedkope lot-telling via de JSON-API-listing
//                 (met --deep draait i.p.v. dat de volledige dispatcher-scrape).
// mode 'scrape' → run de scraper scrape-only en tel de horses in de output.
// skip          → in de map gedocumenteerd, maar overgeslagen (reden erbij);
//                 activeer door 'skip' te verwijderen en een ACTUELE veiling-URL
//                 in te vullen (een oude/afgelopen URL geeft 0 lots → rood).
const FIXTURES = [
  { key: 'weauction',    label: 'The Collection (nieuwe frontend)', mode: 'api',
    url: 'https://bid.thecollection-auction.com/auctions/34cbecb6-1d90-43aa-ad17-08de9f859131?auctionPage=1&itemsPage=1' },
  { key: 'weauction',    label: 'Aloga (oude tenant → nu API)', mode: 'api',
    url: 'https://bid.aloga-auction.com/auctions/98423791-25df-4b65-ad6d-08dd83054a6a' },
  { key: 'weauction',    label: 'WEF Sporthorse (oude tenant → nu API)', mode: 'api',
    url: 'https://bid.wefsporthorseauction.com/auctions/d022bcc1-444c-4ca3-66f7-08dd2bffb060' },

  { key: 'extrahorses',  label: 'Extra Horses (Megève)', mode: 'scrape',
    url: 'https://venteexclusive.extrahorses.com/fr/' },

  // Overige scrapers — representatieve recente veiling per platform (uit de DB).
  // Een afgesloten-maar-nog-online veiling is prima als canary. Werkt een URL
  // niet meer → rood (terecht: stille breuk gevangen); update 'm dan.
  // BEKEND ROOD (26-06-2026): zangersheide.com staat nu achter Cloudflare — een
  // kale fetch geeft 403 (ook de homepage). De fetch-scraper scrape-zangersheide.mjs
  // is daardoor stuk en moet naar een echte-browser-aanpak (Puppeteer, zoals bij
  // Hippomundo). Bewust NIET op 'skip' gezet: de site is niet offline, dit ROOD is
  // een terechte stille-breuk-melding tot de scraper gefixt is.
  { key: 'zangersheide',  label: 'Zangersheide Stallion Auction 2026', mode: 'scrape',
    url: 'https://www.zangersheide.com/nl/auctions/zangersheide-stallion-auction-2026' },
  { key: 'schuttert',     label: 'Schuttert Sport Sales 2026', mode: 'scrape',
    url: 'https://schuttertsportsales.com/lot-category/2026/' },
  { key: 'starsale',      label: 'Starsale Veulenoverzicht 2025', mode: 'scrape',
    url: 'https://www.starsaleauctions.com/veulens/2025/' },
  { key: 'olympic-dream', label: 'Olympic Dream Auction', mode: 'scrape',
    url: 'https://www.jumpingschrodertwente.nl/olympic-dream-auction' },
  { key: 'fences-catalogus', label: 'Fences SERVICE (catalogus)', mode: 'scrape',
    url: 'https://www.fences.fr/cheval/vente/service/' },

  // pwb: alle lots op de collectiepagina (één fetch, geen detailpagina's).
  // Alternatief als deze ooit rood wordt: https://paardenveilingonline.com/collectie/56
  { key: 'pwb',          label: 'PWB / Horse Auction Belgium', mode: 'scrape',
    url: 'https://horseauctionbelgium.com/collectie/41' },
  // livesauction: /live-auction/<id> = collectie, daarna per lot /auction/<slug>
  // (≈30 fetches → wat trager). Woodlands /live-auction/8 gaf 500 (verlopen);
  // vervang door een actuele 334- of woodlands-/live-auction/<id> als deze rood wordt.
  { key: 'livesauction', label: 'Livesauction · 334 Sporthorse Stud', mode: 'scrape',
    url: 'https://334sporthorsestud.com/live-auction/3' },

  // horse24: gedateerde editie als canary. Wordt deze ROOD, check EERST of de
  // pagina nog bestaat (open de URL of curl 'm) vóór je concludeert dat de
  // scraper stuk is — een afgelopen veiling kan offline gaan. Vervang dan door
  // een actuele auction-URL (sitemap: verdener-auktion-online.com/sitemap.xml,
  // of de eerstvolgende OnLive-veiling).
  { key: 'horse24', label: 'HORSE24 · Verdener Fohlen 137', mode: 'scrape',
    url: 'https://verdener-auktion-online.com/de/auctions/details/39-verdener-auktion-online-fohlen-137' },

  // kwpn: /live-veiling/<id> = collectie, daarna per lot /veiling/<slug>
  // (≈26 fetches → wat trager). Wordt deze ROOD, check EERST of de pagina nog
  // bestaat (open de URL of curl 'm) vóór je concludeert dat de scraper stuk is —
  // een afgelopen veiling kan offline gaan. Vervang dan door een actuele
  // kwpn.auction/live-veiling/<id> (zie /collecties op de site).
  { key: 'kwpn', label: 'KWPN Select Sale Dressage', mode: 'scrape',
    url: 'https://kwpn.auction/live-veiling/303' },
]

// ── helpers ──────────────────────────────────────────────────────────────────
const exists = (p) => access(p).then(() => true, () => false)
// Snapshot van data/*.json mét inhoud, zodat we ná de test een door een scraper
// OVERSCHREVEN bestaand bestand kunnen herstellen (en een nieuw bestand wissen).
// Zo vervuilt de test niets in de working tree.
async function dataDirContents() {
  const map = new Map()
  try {
    for (const f of (await readdir(join(ROOT, 'data'))).filter((f) => f.endsWith('.json'))) {
      try { map.set(f, await readFile(join(ROOT, 'data', f))) } catch {}
    }
  } catch {}
  return map
}

/** Goedkope lot-telling via de weauction JSON-API-listing (geen Hippomundo). */
async function apiCount(url) {
  const origin = new URL(url).origin
  const id = (url.match(/\/auctions\/([^/?#]+)/i) || [])[1]
  if (!id) throw new Error('geen /auctions/<id> in URL')
  const r = await fetch(`${origin}/api/auctions/${id}/Items/published?Page=1&PageSize=500`, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(`API HTTP ${r.status}`)
  const j = await r.json()
  const n = Array.isArray(j?.data) ? j.data.length : 0
  return n
}

/** Run een scraper scrape-only via de registry-routing; tel de horses; ruim nieuw bestand op. */
async function scrapeCount(fixture, beforeFiles) {
  const analysis = analyzeUrl(fixture.url, {})
  if (!analysis.ok) throw new Error(`registry routeert niet (${analysis.reason})`)
  if (analysis.scraper.key !== fixture.key) throw new Error(`verkeerde route: ${analysis.scraper.key} i.p.v. ${fixture.key}`)
  if (!analysis.argsOk) throw new Error(`args ontbreken: ${analysis.message || analysis.missing}`)

  const hasEnv = await exists(join(ROOT, '.env.local'))
  const nodeArgs = [...(hasEnv ? ['--env-file=.env.local'] : []), join('scripts', analysis.scraper.script), ...analysis.args]
  const out = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, nodeArgs, { cwd: ROOT, env: process.env })
    let buf = ''
    const t = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`timeout na ${PER_FIXTURE_TIMEOUT_MS / 60000} min`)) }, PER_FIXTURE_TIMEOUT_MS)
    child.stdout.on('data', (d) => { buf += d })
    child.stderr.on('data', (d) => { buf += d })
    child.on('error', (e) => { clearTimeout(t); reject(e) })
    child.on('close', (code) => { clearTimeout(t); code === 0 ? resolve(buf) : reject(new Error(`exit ${code}\n${buf.slice(-600)}`)) })
  })

  const outPath = ([...out.matchAll(/(data\/[^\s'"]+\.json)/g)].pop() || [])[1]
  if (!outPath) throw new Error('geen data/*.json-pad in scraper-output')
  const parsed = JSON.parse(await readFile(join(ROOT, outPath), 'utf8'))
  const records = parsed.horses || (parsed.collections ? parsed.collections.flatMap((c) => c.horses || []) : [])
  // opruimen: bestaand bestand → herstel de originele inhoud; nieuw bestand → wis.
  const base = basename(outPath)
  if (beforeFiles.has(base)) await writeFile(join(ROOT, outPath), beforeFiles.get(base)).catch(() => {})
  else await unlink(join(ROOT, outPath)).catch(() => {})
  return records.length
}

// ── runner ───────────────────────────────────────────────────────────────────
const before = await dataDirContents()
const results = []

for (const fx of FIXTURES) {
  if (fx.skip || !fx.url) { results.push({ fx, status: 'skip', reason: fx.skip || 'geen URL' }); continue }
  const tag = `${fx.key} · ${fx.label}`
  process.stdout.write(`▶ ${tag} … `)
  try {
    let lots
    if (fx.mode === 'api' && !DEEP) lots = await apiCount(fx.url)
    else lots = await scrapeCount(fx, before)         // 'scrape', of 'api' + --deep (volledige dispatcher)
    const ok = lots > 0
    results.push({ fx, status: ok ? 'ok' : 'fail', lots, reason: ok ? null : '0 lots' })
    console.log(ok ? `✅ ${lots} lots` : `❌ 0 lots`)
  } catch (e) {
    results.push({ fx, status: 'fail', lots: 0, reason: e.message.split('\n')[0] })
    console.log(`❌ ${e.message.split('\n')[0]}`)
  }
}

// ── tabel ────────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────────────────────')
console.log(` Scraper-regressietest ${DEEP ? '(--deep: volledige weauction-scrape)' : '(snel: weauction via API-listing)'}`)
console.log('──────────────────────────────────────────────────────────────')
for (const r of results) {
  const icon = r.status === 'ok' ? '✅' : r.status === 'skip' ? '⏭ ' : '❌'
  const detail = r.status === 'ok' ? `${r.lots} lots` : r.status === 'skip' ? `overgeslagen — ${r.reason}` : r.reason
  console.log(` ${icon} ${(r.fx.key + ' · ' + r.fx.label).padEnd(46)} ${detail}`)
}
const failed = results.filter((r) => r.status === 'fail')
const okCount = results.filter((r) => r.status === 'ok').length
const skipCount = results.filter((r) => r.status === 'skip').length
console.log('──────────────────────────────────────────────────────────────')
console.log(` ${okCount} groen · ${failed.length} rood · ${skipCount} overgeslagen`)
console.log('──────────────────────────────────────────────────────────────')

process.exit(failed.length ? 1 : 0)
