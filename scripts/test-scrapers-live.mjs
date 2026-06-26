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
import { readFile, readdir, unlink, access } from 'node:fs/promises'
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

  // Overige scrapers — vul een ACTUELE veiling-URL in en verwijder 'skip' om mee te testen.
  { key: 'pwb',           label: 'PWB / Horse Auction Belgium', mode: 'scrape', url: '', skip: 'geen actuele veiling-URL ingevuld' },
  { key: 'zangersheide',  label: 'Zangersheide',               mode: 'scrape', url: '', skip: 'geen actuele veiling-URL ingevuld' },
  { key: 'livesauction',  label: 'Livesauction (Pweb)',        mode: 'scrape', url: '', skip: 'geen actuele veiling-URL ingevuld' },
  { key: 'schuttert',     label: 'Schuttert Sport Sales',      mode: 'scrape', url: '', skip: 'geen actuele veiling-URL ingevuld' },
  { key: 'starsale',      label: 'Starsale',                   mode: 'scrape', url: '', skip: 'geen actuele veiling-URL ingevuld' },
  { key: 'olympic-dream', label: 'Olympic Dream Auction',      mode: 'scrape', url: '', skip: 'geen actuele veiling-URL ingevuld' },
  { key: 'fences-catalogus', label: 'Fences (catalogus)',      mode: 'scrape', url: '', skip: 'needsExistingCollection — apart te testen via een bestaande collectie' },
]

// ── helpers ──────────────────────────────────────────────────────────────────
const exists = (p) => access(p).then(() => true, () => false)
async function dataDirSnapshot() {
  try { return new Set((await readdir(join(ROOT, 'data'))).filter((f) => f.endsWith('.json'))) }
  catch { return new Set() }
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
  // opruimen: enkel een bestand verwijderen dat dit script zelf nieuw aanmaakte
  if (!beforeFiles.has(basename(outPath))) {
    await unlink(join(ROOT, outPath)).catch(() => {})
  }
  return records.length
}

// ── runner ───────────────────────────────────────────────────────────────────
const before = await dataDirSnapshot()
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
