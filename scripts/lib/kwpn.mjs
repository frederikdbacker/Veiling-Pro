// KWPN-veiling-platform scraper (kwpn.auction — Pweb/Media-Primair-familie).
//
// kwpn.auction is verwant aan de livesauction-sites (334 / Woodlands), maar de
// lot-detail-markup wijkt wezenlijk af — daarom een EIGEN scraper i.p.v. een
// uitbreiding van scrape-livesauction.mjs (dat blijft byte-voor-byte ongemoeid).
// Volgt het horse24-patroon: kernlogica hier in de lib, dunne CLI-wrapper in
// scripts/scrape-kwpn.mjs.
//
// Verschillen met livesauction (live geverifieerd 2026-06):
//   - collectiepagina  /live-veiling/<id>     (NL)  i.p.v.  /live-auction/<id>
//   - lot-detailpagina /veiling/<slug>              i.p.v.  /auction/<slug>
//   - velden in  <td><i…></i>&nbsp;LABEL:</td><td>VALUE</td>  (geen <th><b>…)
//   - afstamming in een rowspan-driehoek <table class="table-pedigree triangle-left">
//     → de échte moeder (de slug "sire-x-damsire" geeft de moedersVADER, niet de moeder)
//   - lotnummer als prefix in de H1 ("399. NAAM …")
//   - discipline per lot uit de collectiekaart (dressuur/springen) — NIET hardcoden
//
// Geen externe dependencies — Node 20+ (global fetch).

// Echte browser-UA: sommige van deze platforms filteren op UA (memory).
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── kleine pure helpers (bewust gekopieerd uit scrape-livesauction.mjs, niet
//    geïmporteerd: dat script exporteert niets en blijft onaangeroerd; ooit samen
//    in scripts/lib/scrape-helpers.mjs — niet nu) ─────────────────────────────
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
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() || null
}

function genderToNL(value) {
  if (!value) return null
  const v = value.toLowerCase()
  if (v.includes('hengst') || v === 'stallion' || v === 'colt') return 'hengst'
  if (v.includes('merrie') || v === 'mare' || v === 'filly')    return 'merrie'
  if (v.includes('ruin')   || v === 'gelding')                  return 'ruin'
  return value
}

function parseDateToYear(s) {
  if (!s) return null
  const ymd = s.match(/(\d{4})/)
  return ymd ? parseInt(ymd[1], 10) : null
}

function parseSize(s) {
  if (!s) return null
  // KWPN levert een kaal getal ("164"); kap af op het getal (anders sleept
  // "164 BTW-plichtig: …" mee als de waarde-cel meer bevat).
  const m = s.match(/(\d{2,3}(?:[.,]\d)?)\s*(?:cm)?/i)
  return m ? `${m[1]} cm` : null
}

function slugify(name) {
  return (name || '').toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Nederlandse maand → ISO-datum (best-effort; collectie-datum voor de status).
const NL_MONTHS = { jan: '01', feb: '02', mrt: '03', maa: '03', apr: '04', mei: '05', jun: '06', jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', dec: '12' }
function parseDutchDate(s) {
  if (!s) return null
  const m = s.match(/(\d{1,2})\s+([a-z]{3})[a-z.]*\s+(\d{4})/i)
  if (!m) return null
  const mm = NL_MONTHS[m[2].toLowerCase().slice(0, 3)]
  if (!mm) return null
  return `${m[3]}-${mm}-${String(m[1]).padStart(2, '0')}`
}

// ── fetch ────────────────────────────────────────────────────────────────────
async function fetchHtml(url, fetchFn) {
  const res = await fetchFn(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.text()
}

// ── veld-parsing (<td>…LABEL:</td><td>VALUE</td>) ─────────────────────────────
function extractField(html, label) {
  // tolereer een icon-<i>-prefix, &nbsp;, witruimte en de spatie vóór ':'
  const re = new RegExp(
    `<td[^>]*>\\s*(?:<i[^>]*>[\\s\\S]*?</i>)?\\s*(?:&nbsp;|\\s)*${label}\\s*:?\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`,
    'i',
  )
  return clean(html.match(re)?.[1])
}

// ── afstamming: rowspan-aware driehoek → geneste {sire,dam}-boom ──────────────
// Celnaam = de eerste regel vóór <br> (de naam; de tweede regel zoals
// "STB ELITE, PREFERENT" is een predicaat → weglaten).
function cellName(tdInner) {
  const first = String(tdInner).split(/<br\s*\/?>/i)[0]
  return clean(first)
}

/**
 * Parse <table class="table-pedigree triangle-left"> robuust naar het bestaande
 * lots.pedigree-formaat. Werkt op GEOMETRIE (kolom = generatie, rij+rowspan =
 * positie), niet op celtelling — een onvolledige stamboom levert een PARTIËLE
 * boom (ontbrekende knopen = null), nooit een crash of verschuiving.
 *
 * Formaat (identiek aan scripts/lib/horse24.mjs):
 *   pedigree = { sire: <branch>, dam: <branch> }
 *   branch  = { name, sire: <node>|null, dam: <node>|null }   (gen1)
 *   node    = { name, sire: <string|null>, dam: <string|null> } (gen2; gen3 = string)
 */
function parsePedigree(html) {
  const t = html.match(/<table[^>]*table-pedigree[\s\S]*?<\/table>/i)
  if (!t) return { pedigree: null, pedigree_raw: null }
  const rows = [...t[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((m) => m[0])
  if (!rows.length) return { pedigree: null, pedigree_raw: null }

  // Rowspan-aware grid-fill: plaats elke <td> in de meest-linkse kolom die op
  // deze rij vrij is; kolom-index = generatie (0=ouder, 1=grootouder, 2=ovgr).
  const colNextFree = []           // colNextFree[col] = eerste rij waarop kolom weer vrij is
  const cells = []                 // { gen, idx, name }
  rows.forEach((rowHtml, r) => {
    const tds = [...rowHtml.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)]
    for (const td of tds) {
      let col = 0
      while ((colNextFree[col] || 0) > r) col++
      const rs = Math.max(1, parseInt((/rowspan\s*=\s*"?(\d+)/i.exec(td[1]) || [])[1] || '1', 10))
      colNextFree[col] = r + rs
      cells.push({ gen: col, idx: Math.floor(r / rs), name: cellName(td[2]) })
    }
  })

  const at = (gen, idx) => cells.find((c) => c.gen === gen && c.idx === idx)?.name || null
  const node = (name, sName, dName) =>
    (!name && !sName && !dName) ? null : { name: name || null, sire: sName || null, dam: dName || null }
  const branch = (name, sNode, dNode) =>
    (!name && !sNode && !dNode) ? null : { name: name || null, sire: sNode || null, dam: dNode || null }

  // gen0: 0=vader, 1=moeder · gen1: 0..3 grootouders · gen2: 0..7 overgrootouders
  const sire = branch(
    at(0, 0),
    node(at(1, 0), at(2, 0), at(2, 1)),
    node(at(1, 1), at(2, 2), at(2, 3)),
  )
  const dam = branch(
    at(0, 1),
    node(at(1, 2), at(2, 4), at(2, 5)),
    node(at(1, 3), at(2, 6), at(2, 7)),
  )
  if (!sire && !dam) return { pedigree: null, pedigree_raw: null }

  const pedigree = { sire, dam }

  // Leesbare 3-generatie-tekst (zelfde vorm als horse24.mjs).
  const lines = []
  if (sire) lines.push(`V: ${sire.name ?? '?'} (${sire.sire?.name ?? '?'} × ${sire.dam?.name ?? '?'})`)
  if (dam) lines.push(`M: ${dam.name ?? '?'} (${dam.sire?.name ?? '?'} × ${dam.dam?.name ?? '?'})`)
  const pair = (n) => n ? `${n.sire ?? '?'} × ${n.dam ?? '?'}` : '?'
  for (const [lbl, n] of [['VV', sire?.sire], ['VM', sire?.dam], ['MV', dam?.sire], ['MM', dam?.dam]]) {
    if (n?.name) lines.push(`${lbl} ${n.name}: ${pair(n)}`)
  }
  return { pedigree, pedigree_raw: lines.join('\n') || null }
}

// ── discipline (per lot uit de collectiekaart; nooit hardcoden) ───────────────
function normalizeDiscipline(s) {
  if (!s) return null
  const v = s.toLowerCase()
  if (/dressuur|dressage/.test(v)) return 'Dressuur'
  if (/springen|jumping/.test(v)) return 'Springen'
  return null
}

// ── lot-detail parsen ─────────────────────────────────────────────────────────
function parseLot(html, url, base, fallbackDiscipline) {
  const rawTitle = clean(html.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1])
  // H1 = "399. TONY GOLD - WILDCARD - SELECTED & PREMIUM"
  let lot_number = null, name = rawTitle, predikaten = null
  const lm = rawTitle?.match(/^\s*(\d+)\.\s*(.+)$/)
  if (lm) {
    lot_number = parseInt(lm[1], 10)
    const rest = lm[2].trim()
    // paardennaam vóór de eerste " - "; KWPN-predikaten (WILDCARD/SELECTED &
    // PREMIUM …) erna apart bewaren (geen info-verlies, niet in de naam).
    const dash = rest.split(/\s+-\s+/)
    name = dash[0].trim()
    if (dash.length > 1) predikaten = dash.slice(1).join(' - ').trim()
  }

  const dob = extractField(html, 'Geboortedatum')
  const year = parseDateToYear(dob)
  const gender = genderToNL(extractField(html, 'Geslacht'))
  const studbook = extractField(html, 'Stamboek')
  const size = parseSize(extractField(html, 'Stokmaat'))
  const color = extractField(html, 'Kleur')

  const { pedigree, pedigree_raw } = parsePedigree(html)
  const sire = pedigree?.sire?.name || null
  const dam = pedigree?.dam?.name || null     // de ÉCHTE moeder (niet de slug-damsire)

  // Foto's: full-res via fancybox-href /userfiles/image/…; src= is een thumbnail.
  const photos = [...new Set(
    [...html.matchAll(/href="(\/userfiles\/image\/[^"]+\.(?:jpg|jpeg|png))"/gi)].map((m) => base + m[1]),
  )].filter((u) => !/logo|flag/i.test(u))

  // Externe afstammingslink (HorseTelex) — wordt door import-lots gemapt.
  const url_horsetelex = html.match(/href="(https?:\/\/[^"]*horsetelex[^"]+)"/i)?.[1] || null

  // Video: vimeo/youtube embed (best-effort).
  const videoMatch = html.match(/(player\.vimeo\.com\/video\/\d+|youtube\.com\/(?:watch\?v=|embed\/)[a-zA-Z0-9_-]+)/i)
  const video_url = videoMatch ? `https://${videoMatch[1].replace('youtube.com/embed/', 'youtube.com/watch?v=')}` : null

  // Catalogtekst: eerste zinvolle <p> die geen boilerplate is (best-effort).
  let catalog_text = null
  for (const m of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const txt = clean(m[1])
    if (txt && txt.length >= 60 && !/dierenarts|ingelogd|inloggen|cookie|registreer|wachtwoord/i.test(txt)) {
      catalog_text = txt
      break
    }
  }

  const catalogNote = [predikaten, color ? `Kleur: ${color}.` : null].filter(Boolean).join(' ') || null

  return {
    lot_number,
    name,
    slug: slugify(name),
    discipline: fallbackDiscipline || null,
    year,
    gender,
    size,
    studbook,
    sire,
    dam,
    pedigree,
    pedigree_raw,
    photos,
    video_url,
    url_horsetelex,
    source_url: url,
    catalog_text,
    starting_bid: null,
    notes: catalogNote ? { catalog: catalogNote } : null,
  }
}

// ── collectie-orkestratie ──────────────────────────────────────────────────────
/**
 * Haal een volledige KWPN-collectie op.
 * @param {string} base        origin, bv. https://kwpn.auction
 * @param {string} auctionId   collectie-id uit /live-veiling/<id>
 * @param {object} opts        { onProgress, fetch, limit, concurrency }
 * @returns {Promise<{meta:object, horses:object[]}>}
 */
export async function scrapeCollection(base, auctionId, opts = {}) {
  const fetchFn = opts.fetch || globalThis.fetch
  const concurrency = opts.concurrency || 6

  const collUrl = `${base}/live-veiling/${auctionId}`
  const collHtml = await fetchHtml(collUrl, fetchFn)

  const collTitle = clean(collHtml.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1])
    || clean(collHtml.match(/<title>\s*([^|<]+?)\s*[|<]/i)?.[1])
    || `KWPN live-veiling ${auctionId}`
  const collDiscipline = normalizeDiscipline(collTitle)
  const date = parseDutchDate(collHtml)

  // Lot-links + per-lot discipline-hint uit de kaart (laatste discipline-woord
  // vóór de link). Volgorde = catalogusvolgorde.
  const linkRe = /href="(\/veiling\/[^"\s#?]+)"/g
  const seen = new Set()
  const lots = []
  let m
  while ((m = linkRe.exec(collHtml))) {
    const rel = m[1]
    if (seen.has(rel)) continue
    seen.add(rel)
    const win = collHtml.slice(Math.max(0, m.index - 1500), m.index)
    const disc = [...win.matchAll(/dressuur|dressage|springen|jumping/gi)].pop()?.[0]
    lots.push({ rel, discipline: normalizeDiscipline(disc) || collDiscipline })
  }
  if (opts.limit) lots.length = Math.min(lots.length, opts.limit)

  // Detailpagina's parallel ophalen (begrensd). Detailpagina is nodig: de
  // collectiepagina heeft geen veldlabels en geen echte moeder.
  const out = new Array(lots.length)
  let done = 0
  const queue = lots.map((l, i) => ({ ...l, i }))
  async function worker() {
    while (queue.length) {
      const job = queue.shift()
      const url = base + job.rel
      try {
        const html = await fetchHtml(url, fetchFn)
        out[job.i] = parseLot(html, url, base, job.discipline)
      } catch (e) {
        out[job.i] = null
        opts.onProgress?.({ done, total: lots.length, name: `⚠ ${job.rel} — ${e.message}` })
      }
      done++
      opts.onProgress?.({ done, total: lots.length, name: out[job.i]?.name || '' })
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, lots.length || 1) }, worker))

  const horses = out.filter((h) => h && h.name)

  const meta = {
    auction: collTitle,
    slug: slugify(`${collTitle}-${auctionId}`),
    system_auction_id: auctionId,
    website: base,
    source_url: collUrl,
    date,
    total: horses.length,
  }
  return { meta, horses }
}

export { parsePedigree, parseLot, normalizeDiscipline, parseDutchDate }
