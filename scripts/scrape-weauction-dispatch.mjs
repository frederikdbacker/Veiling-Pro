// weauction-dispatcher — kiest de juiste weauction-scraper op CAPACITEIT, niet
// op host. Probleem dat dit oplost: migreert een tenant naar de nieuwe
// Tailwind-frontend, dan blijft zijn host anders naar de oude DOM-scraper
// wijzen → stil 0 lots. Daarom: probeer eerst de JSON-API; werkt die → de
// API-scraper (incl. Hippomundo-stamboom); geen API hier → de Puppeteer-DOM-
// scraper als vangnet.
//
// Geverifieerd (26-06-2026): álle bekende weauction-tenants (The Collection,
// Aloga, WEF, De Wolden) leveren de JSON-API op:
//   GET <origin>/api/auctions/<auctionId>/Items/published?Page=1&PageSize=N
//     → { totalRecords, data: [ …lots… ] }
// De DOM-scraper is daardoor in de praktijk enkel nog vangnet (oude frontend
// zonder API).
//
// HERGEBRUIK ZONDER DUPLICATIE: de twee bestaande scrapers
// (scrape-weauction-api.mjs en scrape-weauction.mjs) lezen allebei
// process.argv[2..4] = <url> <house> [collection]. Deze dispatcher krijgt exact
// dezelfde args en draait de gekozen scraper via een dynamische import IN
// HETZELFDE PROCES — dus beide scrapers blijven byte-voor-byte ongewijzigd, geen
// subprocess en geen Puppeteer-orphans.
//
// Gebruik (zoals de worker spawnt):
//   node scripts/scrape-weauction-dispatch.mjs <auction-url> <house> [collection]

const AUCTION_URL = process.argv[2]
const HOUSE = process.argv[3]
// process.argv[4] (collection-naam) wordt ongemoeid doorgegeven aan de delegate.

if (!AUCTION_URL || !HOUSE) {
  console.error('Usage: node scripts/scrape-weauction-dispatch.mjs <auction-url> <house> [collection]')
  process.exit(1)
}

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }

let ORIGIN = null
try { ORIGIN = new URL(AUCTION_URL).origin } catch { /* ongeldige URL → DOM beslist zelf */ }
const AUCTION_ID = (AUCTION_URL.match(/\/auctions\/([^/?#]+)/i) || [])[1] || null

/**
 * Beslis op capaciteit. Onderscheidt bewust:
 *   • API geeft data           → 'api'   (nieuwe frontend / API aanwezig)
 *   • API 404 of 200-met-0-lots → 'dom'   (echte afwezigheid → vangnet terecht)
 *   • timeout / DNS / 5xx       → TRANSIENT: één retry, anders LUIDE fout.
 * Een transiente blip mag NOOIT stilletjes naar de trage DOM-route leiden en
 * alsnog 0 lots opleveren — dat is precies de stille breuk die we uitsluiten.
 */
async function decideRoute() {
  // Geen bruikbaar auction-id (bv. oude weauction.nl-URL-vorm) → laat de
  // DOM-scraper het zelf uitzoeken; daar kan de API toch niet op geprobed worden.
  if (!ORIGIN || !AUCTION_ID) return { decision: 'dom', reason: 'geen /auctions/<id> in URL — DOM-scraper beslist zelf' }

  const probeUrl = `${ORIGIN}/api/auctions/${AUCTION_ID}/Items/published?Page=1&PageSize=1`
  let lastErr = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(probeUrl, { headers: UA, signal: AbortSignal.timeout(20000) })
      if (r.status === 404) return { decision: 'dom', reason: 'API 404 — geen JSON-API op deze tenant (DOM-vangnet)' }
      if (r.status >= 500) { lastErr = new Error(`API HTTP ${r.status}`); continue }   // serverfout = transient → retry
      if (!r.ok)            return { decision: 'dom', reason: `API HTTP ${r.status} — DOM-vangnet` } // andere 4xx → echt afwezig
      const j = await r.json()
      const n = Array.isArray(j?.data) ? j.data.length : 0
      const total = Number.isFinite(j?.totalRecords) ? j.totalRecords : n
      if (n > 0 || total > 0) return { decision: 'api', reason: `API geeft ${total} lots` }
      return { decision: 'dom', reason: 'API leeg (0 lots) — DOM-vangnet' }
    } catch (e) {
      lastErr = e   // timeout / DNS / connectie → transient
      if (attempt === 1) console.error(`⚠️  API-probe poging ${attempt} faalde (${e.message}) — één retry…`)
    }
  }
  // Na de retry nóg transient: NIET stil terugvallen op DOM.
  throw new Error(`weauction API onbereikbaar (transient): ${lastErr?.message || 'onbekend'}. NIET teruggevallen op de DOM-scraper om een stille 0-lots te vermijden — probeer het zo opnieuw.`)
}

let route
try {
  route = await decideRoute()
} catch (e) {
  console.error('❌', e.message)
  process.exit(1)
}
console.log(`🔀 weauction-route: ${route.decision === 'api' ? 'JSON-API (scrape-weauction-api.mjs)' : 'DOM-fallback (scrape-weauction.mjs)'} — ${route.reason}`)

// Delegeer: de gekozen scraper draait in dit proces op dezelfde process.argv
// (argv[2..4]) en print zelf het data/*.json-pad + voortgang.
try {
  await import(route.decision === 'api' ? './scrape-weauction-api.mjs' : './scrape-weauction.mjs')
} catch (e) {
  console.error('❌ weauction-scraper faalde:', e?.message || e)
  process.exit(1)
}
