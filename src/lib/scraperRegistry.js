// Scraper-registry — gedeelde bron van waarheid voor "welke scraper hoort bij
// welke geplakte collectie-URL". Bewust PUUR: enkel `new URL()`, regex en
// platte data, GEEN Node-API's en GEEN browser-API's, zodat zowel de SPA
// (live URL-validatie in de modal) als de worker (bin/scrape-worker.mjs) exact
// dezelfde mapping gebruiken. Eén plek om een nieuwe site toe te voegen.
//
// Zie docs/plan-plak-collectielink-ingest.md (sectie G).
//
// Elke scraper-definitie:
//   key                    machine-sleutel, ook opgeslagen in scrape_jobs.scraper_key
//   label                  mensvriendelijke platformnaam (UI)
//   match(u)               (URL) => bool — herkent deze site dit?
//   script                 scriptbestand in scripts/ dat de worker spawnt
//   importer               importeerscript (default import-lots.mjs)
//   engine                 'puppeteer' | 'fetch' (puur informatief / voor UI-hint)
//   needsHouseName         vereist de scraper een huisnaam-arg? (uit context)
//   needsExistingCollection  importer vult een BESTAANDE collectie i.p.v. er een te maken
//   houseHint(u)           optionele default-huisnaam afgeleid uit de host
//   buildArgs(ctx)         => { ok, args } | { ok:false, missing, message }
//                            ctx = { url:URL, rawUrl, houseName, collectionName }

// ── kleine pure helpers voor arg-afleiding ─────────────────────────────────

/** Laatste niet-leeg pad-segment, zonder trailing slash. */
function lastSegment(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : null
}

/** Fences vente-slug uit /cheval/vente/<slug>/(...) */
export function slugFromFencesUrl(u) {
  const m = u.pathname.match(/\/cheval\/vente\/([^/]+)/i)
  return m ? decodeURIComponent(m[1]) : null
}

/** Zangersheide collection-slug uit /…/auctions/<slug> */
export function zhSlug(u) {
  const m = u.pathname.match(/\/auctions\/([^/]+)/i)
  return m ? decodeURIComponent(m[1]) : null
}

/** Eerste 4-cijferig jaartal (19xx/20xx) uit het pad. */
export function yearFrom(u) {
  const m = u.pathname.match(/\b(19|20)\d{2}\b/)
  return m ? m[0] : null
}

/** Livesauction (Pweb): base-origin + auction-id uit /live-auction/<id>. */
export function liveAuctionParts(u) {
  const m = u.pathname.match(/\/live-auction\/(\d+)/i)
  return { base: u.origin, auctionId: m ? m[1] : null }
}

/**
 * Canonieke sleutel van een collectie-bron-URL, voor dedupe op de link.
 *
 * BELANGRIJK — moet TEKEN-VOOR-TEKEN gelijk zijn aan de gegenereerde
 * DB-kolom `collections.source_url_norm` (migratie 0037):
 *   lower( strip-trailing-slash( strip-vanaf-?-of-#( btrim(url) ) ) )
 * Laag 1 (worker) matcht in JS met deze functie; laag 3 (uniek slot) zit op de
 * SQL-kolom. Wijken ze af, dan mist laag 1 een bestaande veiling en valt de
 * import op de unieke index i.p.v. netjes "staat er al" te melden — dus elke
 * wijziging hier moet samen met de migratie-expressie mee.
 *
 * Bewust simpel en deterministisch: we strippen ALLE query-/fragment-parameters,
 * want voor de huidige sites zit de veiling-identiteit in het PAD (UUID/slug),
 * niet in een parameter. Zet een site de id ooit in een parameter, dan voegen we
 * hier (en in de migratie) een per-site whitelist toe.
 *
 * @returns {string|null} genormaliseerde link, of null bij lege/witruimte-input.
 */
export function normalizeSourceUrl(rawUrl) {
  const trimmed = String(rawUrl ?? '').trim()
  if (!trimmed) return null
  return trimmed
    .replace(/[?#].*$/, '')   // alles vanaf de eerste ? of # weg
    .replace(/\/+$/, '')      // trailing slashes weg
    .toLowerCase()
}

// ── de registry ────────────────────────────────────────────────────────────

export const SCRAPERS = [
  {
    // weauction — ÉÉN entry voor alle weauction-tenants (oud + nieuw). De keuze
    // tussen de JSON-API-scraper en de Puppeteer-DOM-scraper valt NIET hier op
    // host, maar in scrape-weauction-dispatch.mjs op CAPACITEIT (API aanwezig?).
    // Zo blijft een tenant die naar de nieuwe Tailwind-frontend migreert gewoon
    // werken, zonder registry-wijziging.
    //
    // BEWUSTE KEUZE: `match` blijft een host-ALLOWLIST. Een gloednieuwe
    // weauction-tenant (andere host) moet hier nog steeds met zijn host worden
    // toegevoegd — we matchen niet blind op "ziet eruit als weauction", om
    // valse matches op willekeurige sites te vermijden. Nieuwe host erbij? Voeg
    // 'm toe aan match + houseHint hieronder.
    key: 'weauction',
    label: 'weauction',
    engine: 'puppeteer',                       // beide routes gebruiken Puppeteer (API voor Hippomundo, DOM voor alles)
    script: 'scrape-weauction-dispatch.mjs',
    importer: 'import-lots.mjs',
    needsHouseName: true,
    match: (u) =>
      /^bid\.thecollection-auction\.com$/i.test(u.hostname) ||
      /(^|\.)weauction\.nl$/i.test(u.hostname) ||
      /^bid\.(aloga-auction|wefsporthorseauction|dewoldensummersale)\.com$/i.test(u.hostname) ||
      u.hostname.toLowerCase() === 'swbauction.swb.org',
    houseHint: (u) => {
      const h = u.hostname.toLowerCase()
      if (h.includes('thecollection-auction')) return 'The Collection'
      if (h.includes('aloga')) return 'Aloga'
      if (h.includes('wefsporthorse')) return 'WEF Sporthorse Auction'
      if (h.includes('dewoldensummersale')) return 'De Wolden Summer Sale'
      if (h.includes('swbauction')) return 'Swedish Warmblood'
      return null
    },
    buildArgs: ({ rawUrl, houseName, collectionName }) => {
      if (!houseName) return { ok: false, missing: 'house', message: 'Huisnaam ontbreekt voor deze weauction-collectie.' }
      // collectionName doorgeven (argv[4]) → "Catalogus ophalen" in een
      // bestaande collectie vult die i.p.v. een nieuwe te maken (geen duplicaat).
      const args = [rawUrl, houseName]
      if (collectionName) args.push(collectionName)
      return { ok: true, args }
    },
  },

  {
    key: 'fences-catalogus',
    label: 'Fences (catalogus)',
    engine: 'fetch',
    script: 'scrape-fences-catalogus.mjs',
    importer: 'import-fences-catalogus.mjs',
    needsExistingCollection: true, // de Fences-importer vult een al-bestaande collectie
    houseHint: () => 'Agence Fences',
    match: (u) => /(^|\.)fences\.fr$/i.test(u.hostname) && /\/cheval\/vente\//i.test(u.pathname),
    buildArgs: ({ url }) => {
      const slug = slugFromFencesUrl(url)
      if (!slug) return { ok: false, missing: 'slug', message: 'Kon de vente-slug niet uit de Fences-URL halen.' }
      const year = yearFrom(url)
      return { ok: true, args: year ? [slug, year] : [slug] }
    },
  },

  {
    key: 'pwb',
    label: 'PWB / Horse Auction Belgium',
    engine: 'fetch',
    script: 'scrape-pwb.mjs',
    importer: 'import-lots.mjs',
    match: (u) =>
      /(horseauctionbelgium|paardenveilingonline)\.com$/i.test(u.hostname) &&
      /\/collectie\/\d+/.test(u.pathname),
    buildArgs: ({ rawUrl }) => ({ ok: true, args: [rawUrl] }),
  },

  {
    key: 'zangersheide',
    label: 'Zangersheide',
    engine: 'fetch',
    script: 'scrape-zangersheide.mjs',
    importer: 'import-lots.mjs',
    houseHint: () => 'Zangersheide',
    match: (u) => /(^|\.)zangersheide\.com$/i.test(u.hostname) && /\/auctions\//i.test(u.pathname),
    buildArgs: ({ url }) => {
      const slug = zhSlug(url)
      if (!slug) return { ok: false, missing: 'slug', message: 'Kon de collectie-slug niet uit de Zangersheide-URL halen.' }
      return { ok: true, args: [slug] }
    },
  },

  {
    key: 'livesauction',
    label: 'Livesauction (Pweb)',
    engine: 'fetch',
    script: 'scrape-livesauction.mjs',
    importer: 'import-lots.mjs',
    needsHouseName: true,
    match: (u) => /(^|\.)(334sporthorsestud\.com|woodlandsinternational\.eu)$/i.test(u.hostname),
    houseHint: (u) => {
      const h = u.hostname.toLowerCase()
      if (h.includes('334sporthorsestud')) return '334 Auction'
      if (h.includes('woodlandsinternational')) return 'Woodlands International Sales'
      return null
    },
    buildArgs: ({ url, houseName }) => {
      const { base, auctionId } = liveAuctionParts(url)
      if (!auctionId) return { ok: false, missing: 'auction_id', message: 'Kon het collectie-nummer (/live-auction/<id>) niet uit de URL halen.' }
      if (!houseName) return { ok: false, missing: 'house', message: 'Huisnaam ontbreekt voor deze Livesauction-collectie.' }
      return { ok: true, args: [base, auctionId, houseName] }
    },
  },

  {
    key: 'schuttert',
    label: 'Schuttert Sport Sales',
    engine: 'fetch',
    script: 'scrape-schuttert.mjs',
    importer: 'import-lots.mjs',
    houseHint: () => 'Schuttert Sport Sales',
    match: (u) => /(^|\.)schuttertsportsales\.com$/i.test(u.hostname),
    buildArgs: ({ url }) => {
      const year = yearFrom(url)
      if (!year) return { ok: false, missing: 'year', message: 'Kon het jaartal niet uit de Schuttert-URL halen (verwacht /lot-category/<jaar>/).' }
      return { ok: true, args: [year] }
    },
  },

  {
    key: 'starsale',
    label: 'Starsale',
    engine: 'fetch',
    script: 'scrape-starsale.mjs',
    importer: 'import-lots.mjs',
    houseHint: () => 'Starsale Auction',
    match: (u) => /(^|\.)starsaleauctions\.com$/i.test(u.hostname),
    buildArgs: ({ url }) => {
      const year = yearFrom(url)
      if (!year) return { ok: false, missing: 'year', message: 'Kon het jaartal niet uit de Starsale-URL halen.' }
      return { ok: true, args: [year] }
    },
  },

  {
    key: 'extrahorses',
    label: 'Extra Horses',
    engine: 'fetch',
    script: 'scrape-extrahorses.mjs',
    importer: 'import-lots.mjs',
    houseHint: () => 'Extra Horses',
    match: (u) => /(^|\.)venteexclusive\.extrahorses\.com$/i.test(u.hostname),
    buildArgs: ({ rawUrl }) => ({ ok: true, args: [rawUrl] }),
  },

  {
    key: 'olympic-dream',
    label: 'Olympic Dream Auction',
    engine: 'fetch',
    script: 'scrape-olympic-dream-auction.mjs',
    importer: 'import-lots.mjs',
    houseHint: () => 'Olympic Dream Auctions',
    match: (u) => /(^|\.)jumpingschrodertwente\.nl$/i.test(u.hostname),
    buildArgs: () => ({ ok: true, args: [] }),
  },
]

/**
 * Match een geplakte URL tegen de registry.
 * @returns {{ok:true, scraper, url:URL}} | {{ok:false, reason:'invalid_url'|'no_scraper', url?:URL}}
 */
export function matchScraper(rawUrl) {
  let u
  try {
    u = new URL(String(rawUrl || '').trim())
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: 'invalid_url', url: u }
  }
  const scraper = SCRAPERS.find((s) => {
    try { return s.match(u) } catch { return false }
  })
  if (!scraper) return { ok: false, reason: 'no_scraper', url: u }
  return { ok: true, scraper, url: u }
}

/**
 * Volledige check + arg-afleiding voor één URL. Handig voor zowel de UI
 * (toon wat ontbreekt) als de worker (krijg de exacte CLI-args).
 * @param rawUrl  string
 * @param ctx     { houseName?, collectionName? }
 */
export function analyzeUrl(rawUrl, ctx = {}) {
  const m = matchScraper(rawUrl)
  if (!m.ok) return m
  const { scraper, url } = m
  const houseName = ctx.houseName || (scraper.houseHint ? scraper.houseHint(url) : null) || null
  const built = scraper.buildArgs({ url, rawUrl: String(rawUrl).trim(), houseName, collectionName: ctx.collectionName || null })
  return {
    ok: true,
    scraper,
    url,
    houseName,
    houseHint: scraper.houseHint ? scraper.houseHint(url) : null,
    args: built.ok ? built.args : null,
    argsOk: !!built.ok,
    missing: built.ok ? null : built.missing,
    message: built.ok ? null : built.message,
  }
}
