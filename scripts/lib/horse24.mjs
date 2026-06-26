// HORSE24-platform scraper (verdener-auktion-online.com, horse24.com, …).
//
// De HORSE24-sites zijn Vue-apps die hun data server-side meegeven als JSON
// in component-props:
//   - de auction-overzichtspagina bevat  :auction='{…}'  én  :lots='[…]'
//   - elke lot-detailpagina bevat         :lot='{…}'      (rijkere data)
//
// We hoeven dus niet te "scrapen" in de klassieke zin: we lezen de JSON
// rechtstreeks. Eén request geeft de hele collectie; optioneel verrijken
// we elk lot via zijn detailpagina (catalogustekst, afstamming, foto's).
//
// Geen externe dependencies — Node 20+ (global fetch).

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
}

// HTML-entities decoderen (attribuutwaarde is single-quoted; JSON-`"` blijft
// letterlijk, maar `&`, `'`, accenten e.d. kunnen ge-escaped zijn).
function decodeEntities(s) {
  if (!s) return s
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return body in NAMED_ENTITIES ? NAMED_ENTITIES[body] : m
  })
}

// Lees een Vue-prop attribuut (attr='…json…') en parse de JSON erin.
function extractAttrJson(html, attr) {
  const marker = `${attr}='`
  const start = html.indexOf(marker)
  if (start === -1) throw new Error(`Attribuut ${attr} niet gevonden — is dit een HORSE24-auctionpagina?`)
  const from = start + marker.length
  const end = html.indexOf("'", from)
  if (end === -1) throw new Error(`Einde van ${attr} niet gevonden`)
  const raw = decodeEntities(html.slice(from, end))
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error(`JSON in ${attr} kon niet geparsed worden: ${e.message}`)
  }
}

// HTML → platte tekst (paragraaf-breaks behouden).
function htmlToText(html) {
  if (!html) return null
  const t = decodeEntities(
    String(html)
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  )
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || null
}

function firstString(...vals) {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

// Kies een vertaalde waarde uit een {de,en,nl,…}-object (nl-voorkeur).
function pickLang(obj, ...langs) {
  if (obj == null) return null
  if (typeof obj === 'string') return obj
  for (const l of [...langs, 'nl', 'de', 'en']) {
    if (obj[l] != null && String(obj[l]).trim()) return String(obj[l])
  }
  return null
}

// HORSE24 levert de stamboom als <pedigree-view :pedigrees='{V,M,VV,…}'>.
// Posities: V=vader, M=moeder; elke extra letter = volgende generatie
// (V=vadertak, M=moedertak). We bouwen er de geneste {sire,dam}-boom van
// die de DB-kolom `lots.pedigree` al gebruikt: gen1/gen2 = {name,sire,dam},
// gen3 = naam-string.
function parsePedigree(html) {
  const i = html.indexOf('<pedigree-view')
  if (i === -1) return { pedigree: null, pedigree_raw: null }
  const m = /:pedigrees='([^']*)'/.exec(html.slice(i, i + 30000))
  if (!m) return { pedigree: null, pedigree_raw: null }

  let p
  try { p = JSON.parse(decodeEntities(m[1])) } catch { return { pedigree: null, pedigree_raw: null } }

  const nm = (code) => {
    const v = p[code]?.name
    const t = typeof v === 'string' ? v.trim() : null
    return t || null
  }
  // gen2-knoop: object met naam + de twee gen3-namen (strings).
  const node = (code) => {
    const name = nm(code)
    const s = nm(code + 'V'), d = nm(code + 'M')
    if (!name && !s && !d) return null
    return { name, sire: s, dam: d }
  }
  // gen1-knoop: naam + gen2-knopen.
  const branch = (code) => {
    const name = nm(code)
    const s = node(code + 'V'), d = node(code + 'M')
    if (!name && !s && !d) return null
    return { name, sire: s, dam: d }
  }

  const sire = branch('V')
  const dam = branch('M')
  if (!sire && !dam) return { pedigree: null, pedigree_raw: null }

  const pedigree = { sire, dam }

  // Leesbare tekstweergave (3 generaties).
  const pair = (n) => n ? `${n.sire ?? '?'} × ${n.dam ?? '?'}` : '?'
  const lines = []
  if (sire) lines.push(`V: ${sire.name ?? '?'} (${sire.sire?.name ?? '?'} × ${sire.dam?.name ?? '?'})`)
  if (dam) lines.push(`M: ${dam.name ?? '?'} (${dam.sire?.name ?? '?'} × ${dam.dam?.name ?? '?'})`)
  for (const [lbl, n] of [
    ['VV', sire?.sire], ['VM', sire?.dam], ['MV', dam?.sire], ['MM', dam?.dam],
  ]) {
    if (n?.name) lines.push(`${lbl} ${n.name}: ${pair(n)}`)
  }
  return { pedigree, pedigree_raw: lines.join('\n') || null }
}

function detailUrl(auctionUrl, lot) {
  const base = auctionUrl.replace(/\/+$/, '')
  return `${base}/lots/${lot.translated_slug}-${lot.id}`
}

function disciplineOf(lot) {
  const ds = lot.lot_disciplines || lot.lotDisciplines
  if (Array.isArray(ds) && ds.length) {
    return ds.map(d => pickLang(d.title, 'nl') || d.translated_title || d.name)
      .filter(Boolean).join(', ') || null
  }
  return null
}

// Basismapping vanuit een lot in de :lots-array (lijst-niveau).
function mapListLot(lot, auctionUrl) {
  return {
    id: lot.id,
    lot_number: lot.number,
    name: lot.translated_title || pickLang(lot.title, 'nl'),
    slug: lot.translated_slug,
    discipline: disciplineOf(lot),
    year: lot.date_of_birth ? Number(String(lot.date_of_birth).slice(0, 4)) : null,
    gender: pickLang(lot.gender?.title, 'nl') || lot.gender?.translated_title || null,
    size: lot.size || null,
    studbook: null,
    sire: lot.shire || null,
    dam: lot.dam_by || null,
    pedigree: null,
    pedigree_raw: null,
    catalog_text: null,
    photos: [lot.lot_image].filter(Boolean),
    video_url: null,
    source_url: detailUrl(auctionUrl, lot),
    starting_bid: lot.opening_price ?? null,
    is_withdrawn: !!lot.is_withdrawn,
  }
}

// Verrijk met data van de detailpagina (:lot + og:image + afstammingstekst).
function enrichFromDetail(horse, html) {
  let lot
  try { lot = extractAttrJson(html, ':lot') } catch { return horse }

  const catalog = pickLang(lot.additional_information?.[0], 'nl', 'de', 'en')
  const video = firstString(
    lot.main_video?.en, lot.main_video?.de, lot.main_video?.nl,
    ...(Array.isArray(lot.video) ? lot.video : [])
  )

  // Foto's: og:image-meta's zijn de volledige galerij; val terug op lot_image.
  const ogPhotos = [...html.matchAll(/<meta property="og:image" content="([^"]+)"/g)]
    .map(m => m[1])
  const photos = ogPhotos.length ? ogPhotos : horse.photos

  // Afstammingsblok uit de tekst (1. Generation … t/m de footer).
  const bodyText = htmlToText(
    html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  ) || ''
  // Gestructureerde 3-generatie-stamboom uit <pedigree-view>.
  const { pedigree, pedigree_raw: pedigreeText } = parsePedigree(html)
  // Tekst-fallback (oude Mutterstamm-tekst) enkel als er geen stamboom is.
  let pedigreeFallback = null
  const pm = bodyText.match(/(1\.\s*Generation[\s\S]*?)(?:Weitere Vorschläge|Folge uns|RECHTLICHES|$)/)
  if (pm) pedigreeFallback = pm[1].trim()
  // Echte moedernaam (i.p.v. enkel de moedervader uit dam_by). De labels en
  // waarden plakken in de platte tekst aan elkaar, dus tot het volgende label.
  const STOP = '(?:Größe:|Prämierung:|ZL:|ZSP:|Großmutter:|Turniererfolge:|RPF:|Vater:|Mutter:|$)'
  const mother = bodyText.match(new RegExp(`Mutter:\\s*([^|\\n]+?)${STOP}`))
  // Ras / studbook uit de lot-info: label "Rasse" gevolgd door de waarde
  // op de eerstvolgende niet-lege regel.
  const breed = bodyText.match(/\bRasse\s*\n+\s*([^\n]+)/)

  return {
    ...horse,
    name: horse.name || lot.translated_title || pickLang(lot.title, 'nl'),
    gender: horse.gender || pickLang(lot.gender?.title, 'nl') || lot.gender?.translated_title || null,
    size: horse.size || lot.size || null,
    studbook: pickLang(lot.lot_breed?.title, 'nl', 'de') || lot.lot_breed?.translated_title
      || (breed && breed[1].trim()) || horse.studbook,
    sire: pedigree?.sire?.name || horse.sire || lot.shire || null,
    dam: pedigree?.dam?.name || (mother && mother[1].trim()) || horse.dam || lot.dam_by || null,
    pedigree: pedigree || horse.pedigree || null,
    pedigree_raw: pedigreeText || pedigreeFallback || horse.pedigree_raw,
    catalog_text: htmlToText(catalog) || horse.catalog_text,
    photos: photos.length ? photos : horse.photos,
    video_url: video || horse.video_url,
    starting_bid: horse.starting_bid ?? lot.opening_price ?? null,
    url_horsetelex: firstString(lot.translated_horsetelex_link, lot.horsetelex_link),
    url_extra: firstString(lot.pedigree_link, lot.additional_link),
  }
}

/**
 * Haal een volledige veilingcollectie op van een HORSE24-auction-URL.
 *
 * @param {string} auctionUrl  bv. https://verdener-auktion-online.com/de/auctions/details/…-135
 * @param {object} opts
 * @param {boolean} [opts.enrich=true]  detailpagina's ophalen voor volledige data
 * @param {(p:{done:number,total:number,name:string})=>void} [opts.onProgress]
 * @param {number} [opts.concurrency=6]
 * @returns {Promise<{meta:object, horses:object[]}>}
 */
export async function scrapeCollection(auctionUrl, opts = {}) {
  const { enrich = true, onProgress, concurrency = 6 } = opts
  const fetchFn = opts.fetch || globalThis.fetch

  const res = await fetchFn(auctionUrl, { headers: { 'User-Agent': 'veiling-pro-import/1.0' } })
  if (!res.ok) throw new Error(`Auction-pagina ophalen mislukt (HTTP ${res.status})`)
  const html = await res.text()

  const auction = extractAttrJson(html, ':auction')
  const lots = extractAttrJson(html, ':lots')
  const origin = new URL(auctionUrl).origin

  const dateRaw = firstString(auction.live_start, auction.start, auction.end)
  const meta = {
    auction: auction.translated_title || pickLang(auction.title, 'de'),
    auction_i18n: auction.title || null,
    slug: auction.translated_slug || null,
    system_auction_id: auction.system_auction_id ?? auction.id ?? null,
    website: origin,
    source_url: auctionUrl,
    date: dateRaw ? dateRaw.slice(0, 10) : null,
    description: htmlToText(auction.translated_short_description),
    total: lots.length,
  }

  let horses = lots.map(l => mapListLot(l, auctionUrl))
  if (opts.limit) horses = horses.slice(0, opts.limit)

  if (enrich) {
    let done = 0
    const queue = [...horses]
    const out = new Map()
    async function worker() {
      while (queue.length) {
        const h = queue.shift()
        try {
          const r = await fetchFn(h.source_url, { headers: { 'User-Agent': 'veiling-pro-import/1.0' } })
          if (r.ok) out.set(h.id, enrichFromDetail(h, await r.text()))
          else out.set(h.id, h)
        } catch {
          out.set(h.id, h)
        }
        done++
        onProgress?.({ done, total: horses.length, name: h.name })
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, horses.length) }, worker))
    horses = horses.map(h => out.get(h.id) || h)
  }

  horses.sort((a, b) => (a.lot_number ?? 0) - (b.lot_number ?? 0))
  return { meta, horses }
}

export { htmlToText, extractAttrJson }
