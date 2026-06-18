// Schuttert Sport Sales-scraper.
//
// Bron: https://schuttertsportsales.com/lot-category/<jaar>/
// Per jaar wordt de category-pagina opgehaald, gevolgd door elke individuele
// lot-pagina onder /collection/<slug>/. De site is WordPress + Elementor en
// elk lot heeft:
//   - <h1>: "1. PRACTICALLY PERFECT"  of  "BOOMERANG OPTIMUS Z – Sold for €100,000,-"
//   - subtitel "Sire x Dam" of "(Sire x Dam)"
//   - usp-blok met Year / Gender / Size / Studbook
//   - <p>-blokken met catalogtekst
//   - <img> uit /wp-content/uploads/
//   - knop met HorseTelex-link
//   - YouTube-iframes onder een "Videos"-blok
//
// Voor 2024/2025 staat de hamerprijs in de H1 ("Sold for €X,000,-").
// Voor 2026 (toekomstige collectie) staat enkel het lotnummer voor de naam.
//
// Schrijft data/schuttert-<jaar>.json; daarna importeert
// scripts/import-lots.mjs dat in Supabase.
//
// Gebruik:
//   node scripts/scrape-schuttert.mjs 2026
//   node scripts/scrape-schuttert.mjs 2025
//   node scripts/scrape-schuttert.mjs 2024

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const year = process.argv[2]
if (!year || !/^\d{4}$/.test(year)) {
  console.error('Usage: node scripts/scrape-schuttert.mjs <jaar>   (bv. 2026)')
  process.exit(1)
}

const LIST_URL = `https://schuttertsportsales.com/lot-category/${year}/`
const OUT_FILE = `data/schuttert-${year}.json`

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; veiling-pro-scraper)' }

async function fetchHtml(url) {
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.text()
}

function decodeEntities(s) {
  if (s == null) return s
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#8211;/g, '–').replace(/&#8217;/g, '’')
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

// Geslacht → Nederlands (consistent met overige collecties).
const GENDER_NL = {
  mare: 'Merrie', filly: 'Merrie', merrie: 'Merrie',
  stallion: 'Hengst', colt: 'Hengst', hengst: 'Hengst',
  gelding: 'Ruin', ruin: 'Ruin', wallach: 'Ruin',
}

// ── Stap 1: alle lot-URLs uit de category-pagina (in volgorde van eerste verschijning).
const listHtml = await fetchHtml(LIST_URL)
const urlRe = /https:\/\/schuttertsportsales\.com\/collection\/[a-z0-9-]+\/?/gi
const seen = new Set()
const lotUrls = []
let m
while ((m = urlRe.exec(listHtml)) !== null) {
  const u = m[0].endsWith('/') ? m[0] : m[0] + '/'
  if (!seen.has(u)) { seen.add(u); lotUrls.push(u) }
}

if (lotUrls.length === 0) {
  console.error(`❌ Geen lots gevonden op ${LIST_URL}`)
  process.exit(1)
}

console.log(`📋 ${LIST_URL} → ${lotUrls.length} lot-URLs`)

// ── Stap 2: per lot-URL data extraheren.
function parseLot(html, sourceUrl, displayOrder) {
  // H1: "1. PRACTICALLY PERFECT" of "CENTURION AS Z – SOLD FOR €44,000,-"
  const h1Match = html.match(/<h1[^>]*class="elementor-heading-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
  const h1Raw = h1Match ? stripTags(h1Match[1]) : ''
  let lotNumber = null
  let name = h1Raw
  let salePrice = null
  let sold = null

  // "Sold for €X" / "SOLD FOR €X,000,-" → sale_price + sold=true
  const soldMatch = h1Raw.match(/[–-]\s*(?:Sold|SOLD)\s+(?:for|FOR)\s+€([\d.,]+)/)
  if (soldMatch) {
    sold = true
    salePrice = parseInt(soldMatch[1].replace(/[.,]/g, ''), 10) || null
    name = h1Raw.replace(/\s*[–-]\s*(?:Sold|SOLD)\s+(?:for|FOR)\s+€[\d.,\-]+/i, '').trim()
  }
  // Lotnummer-prefix: "12. NAAM"
  const numMatch = name.match(/^(\d+)\.\s+(.+)$/)
  if (numMatch) {
    lotNumber = parseInt(numMatch[1], 10)
    name = numMatch[2].trim()
  }
  // Titel-case normaliseren (de site schrijft alles in CAPS)
  name = toTitleCase(name)

  // Sire x Dam — staat in de eerste text-editor-widget ná de H1,
  // bv. "Comthago VDL x Heartbreaker" of "(Chacfly PS x Marome NW)".
  let sire = null, dam = null
  const afterH1 = h1Match ? html.slice(h1Match.index + h1Match[0].length) : html
  const widgetRe = /<div class="elementor-widget-container">([\s\S]*?)<\/div>/gi
  const sireDamRe = /^\s*\(?\s*([A-ZÀ-Ÿ][\wÀ-ÿ'’.\- ]{1,60}?)\s+x\s+([A-ZÀ-Ÿ][\wÀ-ÿ'’.\- ]{1,60}?)\s*\)?\s*$/i
  let wm
  while ((wm = widgetRe.exec(afterH1)) !== null) {
    const txt = stripTags(wm[1])
    if (!txt) continue
    const sd = txt.match(sireDamRe)
    if (sd) {
      sire = sd[1].trim()
      dam = sd[2].trim()
      break
    }
    // Sla "Vet report"-knoppen e.d. over
    if (txt.length > 120) break  // de eerstvolgende lange tekst is de catalog, geen subtitle
  }

  // USP-blok: Year / Gender / Size / Studbook — title/option-paren staan
  // verspreid binnen geneste <div>'s. We zoeken globaal naar elk paar.
  const fieldRe = /<p class="title">([^<]+)<\/p>\s*<p class="option">([^<]+)<\/p>/gi
  const fields = {}
  let fm
  while ((fm = fieldRe.exec(html)) !== null) {
    fields[fm[1].trim().toLowerCase()] = stripTags(fm[2])
  }
  // "Year: 2020" of (voor veulens) "Date of birth: 25-04-2026" — laatste 4 cijfers.
  let year = null
  if (fields.year) year = parseInt(fields.year, 10) || null
  else if (fields['date of birth']) {
    const ym = fields['date of birth'].match(/(\d{4})/)
    if (ym) year = parseInt(ym[1], 10)
  }
  const genderEn = fields.gender?.toLowerCase()
  const gender = genderEn ? (GENDER_NL[genderEn] || fields.gender) : null
  const size = fields.size || null
  const studbook = fields.studbook || null

  // Catalogtekst — alle <p>-blokken in het main content-gebied tussen H1 en "Photos"
  // Pak alleen <p> die echte zinnen bevatten (geen <img>-only paragraphs).
  let catalogText = null
  const contentEnd = html.search(/<h2[^>]*>\s*Photos/i)
  const contentSlice = contentEnd > 0
    ? html.slice(h1Match?.index ?? 0, contentEnd)
    : html
  const paragraphs = []
  const pRe = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi
  let pm
  while ((pm = pRe.exec(contentSlice)) !== null) {
    // Sla <p> over die alleen een <img> bevatten
    if (/<img\b/i.test(pm[1]) && !/[a-z]{4,}/i.test(stripTags(pm[1]))) continue
    const text = stripTags(pm[1])
    if (text.length > 20) paragraphs.push(text)
  }
  if (paragraphs.length) catalogText = paragraphs.join('\n\n')

  // Foto's — alle <img src> die naar /wp-content/uploads/ wijzen en GEEN logo zijn.
  const imgRe = /<img[^>]*\ssrc="(https:\/\/schuttertsportsales\.com\/wp-content\/uploads\/[^"]+)"/gi
  const photoSet = new Set()
  let im
  while ((im = imgRe.exec(html)) !== null) {
    let src = im[1]
    if (/logo/i.test(src)) continue
    if (/icon|wpemoji/i.test(src)) continue
    // De site genereert sized varianten (-600x400, -1000x1500). Normaliseer
    // naar de originele door de grootte-suffix te strippen.
    src = src.replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')
    photoSet.add(src)
  }
  const photos = [...photoSet]

  // HorseTelex-link
  const htMatch = html.match(/href="(https?:\/\/(?:www\.)?horsetelex\.[a-z.]+\/[^"]+)"/i)
  const url_horsetelex = htMatch ? htMatch[1] : null
  // Hippomundo-link (komt soms voor)
  const hmMatch = html.match(/href="(https?:\/\/(?:www\.)?hippomundo\.[a-z.]+\/[^"]+)"/i)
  const url_hippomundo = hmMatch ? hmMatch[1] : null

  // Video — eerste YouTube-embed pakken
  const ytMatch = html.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/)
  const video_url = ytMatch ? `https://www.youtube.com/watch?v=${ytMatch[1]}` : null

  // Slug uit URL halen (laatste segment)
  const slug = sourceUrl.replace(/\/$/, '').split('/').pop()

  return {
    lot_number: lotNumber ?? null,
    name,
    discipline: 'Springen',          // Schuttert is uitsluitend springpaarden
    year,
    gender,
    size,
    studbook,
    sire,
    dam,
    pedigree_raw: sire && dam ? `${sire} x ${dam}` : null,
    catalog_text: catalogText,
    equiratings_text: null,
    photos,
    video_url,
    source_url: sourceUrl,
    url_horsetelex,
    url_hippomundo,
    starting_bid: null,
    reserve_price: null,
    sold,
    sale_price: salePrice,
    buyer: null,
    buyer_country: null,
    slug,
    notes: {},
    data_reliability: 'scraped',
    missing_info: [
      lotNumber == null && 'lot_number',
      !catalogText && 'catalog_text',
      !video_url && 'video_url',
      !sire && 'sire',
      !dam && 'dam',
    ].filter(Boolean),
    _display_order: displayOrder,
  }
}

// Tussenvoegsels die in NL/DE paardennamen altijd lowercase blijven.
// "as" laten we BEWUST uit deze set — in paardennamen is "AS" doorgaans een
// fokker-/stud-afkorting (bv. "Centurion AS Z"), niet het Engelse woord.
const LOWER_TOKENS = new Set([
  'van','de','der','den','ter','ten','het','op','aan','in','des','du','di','la','le',
  'of','the','and','a',
])

function toTitleCase(s) {
  if (!s) return s
  // Als de input geen all-caps is, niet aanraken.
  if (/[a-z]/.test(s)) return s.trim()
  const words = s.trim().toLowerCase().split(/\s+/)
  // Trailing studbook-/fokker-afkortingen (max 1-3 chars elk) blijven ALL-CAPS.
  // Bv. "EPIDOTE RD Z" → "Epidote RD Z", "CAMILLA VB" → "Camilla VB",
  //     "WIBO VAN DE CRUMELHAEVE" → "Wibo van de Crumelhaeve" (geen suffix).
  const result = words.map((w, i) => {
    if (i > 0 && LOWER_TOKENS.has(w)) return w
    return w.charAt(0).toUpperCase() + w.slice(1)
  })
  // Achterste woorden upper-casen als ze allemaal kort zijn (<=3 letters).
  for (let i = result.length - 1; i > 0; i--) {
    if (words[i].length <= 3 && !LOWER_TOKENS.has(words[i])) {
      result[i] = words[i].toUpperCase()
    } else {
      break
    }
  }
  return result.join(' ')
}

const horses = []
for (let i = 0; i < lotUrls.length; i++) {
  const u = lotUrls[i]
  process.stdout.write(`  [${i + 1}/${lotUrls.length}] ${u} ... `)
  try {
    const html = await fetchHtml(u)
    const lot = parseLot(html, u, i + 1)
    horses.push(lot)
    console.log(`${lot.name}${lot.lot_number ? ` (#${lot.lot_number})` : ''}`)
  } catch (e) {
    console.log(`❌ ${e.message}`)
  }
}

// Sorteer op lot_number indien gezet (2026), anders behoud volgorde uit listing.
horses.sort((a, b) => {
  if (a.lot_number != null && b.lot_number != null) return a.lot_number - b.lot_number
  if (a.lot_number != null) return -1
  if (b.lot_number != null) return 1
  return a._display_order - b._display_order
})
horses.forEach(h => delete h._display_order)

// 2026 = nog komende veiling, 2025/2024 = afgelopen.
const status = parseInt(year, 10) >= new Date().getFullYear() ? 'planned' : 'finished'

const out = {
  meta: {
    collection: `Schuttert Sport Sales ${year}`,
    house: 'Schuttert Sport Sales',
    house_country: 'Nederland',
    website: LIST_URL,
    location: 'Stegeren (Ommen-Noord), Nederland',
    status,
    imported_at: new Date().toISOString(),
    total: horses.length,
    data_source: 'Schuttert Sport Sales-scraper, schuttertsportsales.com',
  },
  horses,
}

await mkdir(dirname(OUT_FILE), { recursive: true })
await writeFile(OUT_FILE, JSON.stringify(out, null, 2))
console.log(`\n✅ ${horses.length} lots → ${OUT_FILE}`)
