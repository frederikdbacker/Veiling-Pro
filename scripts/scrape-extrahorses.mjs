// Extra Horses-scraper (Exclusive Sales — Balsan Enchères).
//
// Bron: https://venteexclusive.extrahorses.com/fr/
// De overzichtspagina levert server-side HTML met per lot een
// "/fr/selection-detail?id=<n>"-link. Per lot wordt de detailpagina opgehaald.
// Elk lot heeft:
//   - <h4>: de naam, of voor embryo's/kruisingen "<Vader> X <Moeder>"
//   - tabel table-info-cheval: GENRE / STUDBOOK / TAILLE
//   - tabel table-info-cheval-bottom: ROBE / ANNEE
//   - <div class="container-selection-image" style="background-image:url(/images/upload/images/<n>.png)">
//   - présentatie-tekst (waarvan de eerste <p> vaak de taille-legende is)
//
// TAILLE-legende: S = 157-164 cm, M = 165-169 cm, L > 170 cm, n/a = onbekend.
//
// Géén Puppeteer nodig (kale fetch volstaat). We gebruiken een volledige
// browser-User-Agent omdat sommige sites bot-UA's met lege HTML beantwoorden,
// en we falen HARD als er 0 lots gevonden worden (nooit stil een lege
// catalogus importeren).
//
// Verkoopprijzen/resultaten lopen op Balsan Enchères en vallen BUITEN deze
// scraper (latere verrijking).
//
// Schrijft data/extrahorses-megeve-2026.json; daarna importeert
// scripts/import-lots.mjs dat in Supabase.
//
// Gebruik:
//   node scripts/scrape-extrahorses.mjs
//   node scripts/scrape-extrahorses.mjs "https://venteexclusive.extrahorses.com/fr/"

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const DEFAULT_URL = 'https://venteexclusive.extrahorses.com/fr/'

// Geplakte link (worker geeft rawUrl door); val terug op de standaard-editie.
let baseOrigin = 'https://venteexclusive.extrahorses.com'
const argUrl = process.argv[2]
if (argUrl) {
  try { baseOrigin = new URL(argUrl).origin } catch { /* val terug op default */ }
}
const LIST_URL = `${baseOrigin}/fr/`
const OUT_FILE = 'data/extrahorses-megeve-2026.json'

// Volledige browser-UA (geen bot-string — sommige sites filteren daarop).
const UA = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

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
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à').replace(/&ecirc;/g, 'ê')
    .replace(/&ucirc;/g, 'û').replace(/&ocirc;/g, 'ô').replace(/&icirc;/g, 'î')
    .replace(/&ccedil;/g, 'ç').replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–').replace(/&#8217;/g, '’')
}

function stripTags(html) {
  return decodeEntities(String(html).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

// Geslacht → Nederlands. GENRE op deze site mengt geslacht en type
// (Jument/Hongre/Etalon = geslacht; Embryon/Poulain = type zonder zeker
// geslacht). Alleen de duidelijke geslachtswoorden mappen; rest → null.
function genderFromGenre(genre) {
  if (!genre) return null
  const g = genre.toLowerCase()
  if (/\bjument\b|\bpouliche\b/.test(g)) return 'Merrie'
  if (/\bhongre\b/.test(g)) return 'Ruin'
  if (/\b(etalon|étalon|entier)\b/.test(g)) return 'Hengst'
  return null // Embryon / Poulain / onbekend
}

// TAILLE S/M/L → leesbare size-string; n/a/leeg → null.
function sizeFromTaille(taille) {
  if (!taille) return null
  const t = taille.trim().toUpperCase()
  if (t === 'S') return 'S (157–164 cm)'
  if (t === 'M') return 'M (165–169 cm)'
  if (t === 'L') return 'L (>170 cm)'
  // Soms een directe cm-waarde
  const cm = taille.match(/(\d{2,3})\s*cm/i)
  if (cm) return `${cm[1]} cm`
  return null // 'n/a' of onbekend
}

// Maand-afkorting (FR/NL/EN) → MM.
const MONTHS = {
  jan: '01', fév: '02', fev: '02', feb: '02', mar: '03', mrt: '03',
  avr: '04', apr: '04', mai: '05', may: '05', jun: '06', jui: '06',
  jul: '07', juil: '07', aug: '08', aoû: '08', aou: '08', sep: '09',
  oct: '10', nov: '11', déc: '12', dec: '12',
}

// "Extrahorses\n Megève -\n 17, Jul. 2026 -\n Extra Horses" → 2026-07-17.
// Faalt het → null (we schrijven dan géén datum weg).
function parseDateFromTitle(title) {
  if (!title) return null
  const flat = stripTags(title)
  const m = flat.match(/(\d{1,2})\s*,?\s*([A-Za-zéèàûô]+)\.?\s+(\d{4})/)
  if (!m) return null
  const day = m[1].padStart(2, '0')
  const monKey = m[2].toLowerCase().slice(0, 3)
  const mon = MONTHS[m[2].toLowerCase()] || MONTHS[monKey]
  if (!mon) return null
  return `${m[3]}-${mon}-${day}`
}

const LOWER_TOKENS = new Set([
  'van', 'de', 'der', 'den', 'ter', 'ten', 'het', 'op', 'aan', 'in', 'des',
  'du', 'di', 'la', 'le', 'of', 'the', 'and', 'a',
])

function toTitleCase(s) {
  if (!s) return s
  if (/[a-z]/.test(s)) return s.trim() // niet all-caps → niet aanraken
  const words = s.trim().toLowerCase().split(/\s+/)
  return words
    .map((w, i) => {
      if (i > 0 && LOWER_TOKENS.has(w)) return w
      // (Stamboek-)afkortingen tussen haakjes blijven zoals ze zijn
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

// "ERMITAGE KALONE ERMITAGE KALONE" → "ERMITAGE KALONE" (verdubbeling weg).
function collapseDoubled(s) {
  const w = s.trim().split(/\s+/)
  if (w.length >= 2 && w.length % 2 === 0) {
    const half = w.length / 2
    if (w.slice(0, half).join(' ') === w.slice(half).join(' ')) {
      return w.slice(0, half).join(' ')
    }
  }
  return s.trim()
}

function parseLot(html, id, sourceUrl) {
  // Naam uit de detail-<h4> (eerste <h4> is de paard-/kruisingstitel).
  const h4Match = html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)
  let rawName = h4Match ? stripTags(h4Match[1]) : ''
  rawName = rawName.replace(/\s*[–-]\s*\d{4}\s*$/, '').trim() // trailing " - 2027" weg

  // " X " → vader × moeder (embryo's/kruisingen).
  let sire = null
  let dam = null
  let name = rawName
  const xSplit = rawName.split(/\s+[xX]\s+/)
  if (xSplit.length === 2) {
    sire = collapseDoubled(xSplit[0])
    dam = xSplit[1].trim()
    name = `${sire} x ${dam}`
  }
  name = toTitleCase(name)
  sire = sire ? toTitleCase(sire) : null
  dam = dam ? toTitleCase(dam) : null

  // Info-tabellen: GENRE / STUDBOOK / TAILLE / ROBE / ANNEE.
  const cell = (label) => {
    const re = new RegExp(`<span>\\s*${label}\\*?\\s*</span>([\\s\\S]*?)</td>`, 'i')
    const m = html.match(re)
    return m ? stripTags(m[1]) : null
  }
  const genre = cell('GENRE')
  const studbookRaw = cell('STUDBOOK')
  const taille = cell('TAILLE')
  const robe = cell('ROBE')
  const anneeRaw = cell('ANNEE')

  const gender = genderFromGenre(genre)
  const studbook = studbookRaw || null
  const size = sizeFromTaille(taille)
  const isEmbryo = /embryon/i.test(genre || '')
  const anneeNum = anneeRaw && /^\d{4}$/.test(anneeRaw.trim()) ? parseInt(anneeRaw.trim(), 10) : null
  // Embryo: jaar bewust op null zodat de importer 'embryo' afleidt; het
  // verwachte jaar bewaren we in catalog_text + markeren in missing_info.
  const year = isEmbryo ? null : anneeNum

  // Présentatie-tekst: alle <p>, maar de taille-legende overslaan.
  const presBlock = html.match(/row-selection-presentation[\s\S]*?(?=<\/section>|<footer|$)/i)
  const presHtml = presBlock ? presBlock[0] : html
  const paragraphs = []
  const pRe = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi
  let pm
  while ((pm = pRe.exec(presHtml)) !== null) {
    const txt = stripTags(pm[1])
    if (!txt) continue
    if (/légende des tailles/i.test(txt) || txt.startsWith('*')) continue
    if (txt.length > 5) paragraphs.push(txt)
  }
  const presText = paragraphs.join('\n\n')

  // catalog_text: compacte info-regels + présentatie.
  const infoLines = []
  if (robe) infoLines.push(`Robe: ${robe}`)
  if (isEmbryo && anneeNum) infoLines.push(`Verwacht geboortejaar: ${anneeNum}`)
  const catalogParts = [...infoLines]
  if (presText) catalogParts.push(presText)
  const catalogText = catalogParts.length ? catalogParts.join('\n') : null

  // Foto's: zowel CSS background-image als <img src> die naar
  // /images/upload/ wijzen. Placeholder (default.jpg) overslaan.
  const photos = []
  const addPhoto = (raw) => {
    let src = raw.replace(/['"]/g, '').trim()
    if (!src || /default\.jpg/i.test(src)) return
    if (src.startsWith('/')) src = baseOrigin + src
    if (/^https?:\/\//i.test(src) && /\/images\/upload\//i.test(src) && !photos.includes(src)) {
      photos.push(src)
    }
  }
  let bm
  const bgRe = /background-image:\s*url\(([^)]+)\)/gi
  while ((bm = bgRe.exec(html)) !== null) addPhoto(bm[1])
  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi
  while ((bm = imgRe.exec(html)) !== null) addPhoto(bm[1])

  const missing = [
    !sire && 'sire',
    !dam && 'dam',
    isEmbryo && 'year', // jaar bewust weggelaten (embryo) — traceerbaar
    !catalogText && 'catalog_text',
    !photos.length && 'photos',
  ].filter(Boolean)

  return {
    lot_number: null, // wordt uit de overzichtspagina gezet
    name,
    discipline: null, // Extra Horses = springpaarden; lot_type-fallback dekt dit
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
    video_url: null,
    source_url: sourceUrl,
    url_horsetelex: null,
    url_hippomundo: null,
    starting_bid: null,
    reserve_price: null,
    sold: null,
    sale_price: null,
    buyer: null,
    buyer_country: null,
    slug: null,
    notes: {},
    data_reliability: 'scraped',
    missing_info: missing,
    _id: id,
  }
}

// ── Stap 1: overzichtspagina → lot-id's + display-lotnummers.
const listHtml = await fetchHtml(LIST_URL)
const rowRe = /<div class="row-height row-height-index">([\s\S]*?selection-detail\?id=(\d+)[\s\S]*?<\/a>)/gi
const lots = []
const seen = new Set()
let rm
while ((rm = rowRe.exec(listHtml)) !== null) {
  const id = rm[2]
  if (seen.has(id)) continue
  seen.add(id)
  const nombreM = rm[1].match(/container-nombre">([\s\S]*?)<\/div>/i)
  const nombre = nombreM ? stripTags(nombreM[1]) : null
  const lotNumber = nombre && /^\d+$/.test(nombre) ? parseInt(nombre, 10) : null
  lots.push({ id, lotNumber })
}

// Vangnet: als de row-regex niets vond, val terug op een platte id-scan.
if (lots.length === 0) {
  const idRe = /selection-detail\?id=(\d+)/gi
  let im
  while ((im = idRe.exec(listHtml)) !== null) {
    if (!seen.has(im[1])) { seen.add(im[1]); lots.push({ id: im[1], lotNumber: null }) }
  }
}

// HARDE check: 0 lots → fout (nooit stil een lege catalogus importeren).
if (lots.length === 0) {
  console.error(`❌ Geen lots gevonden op ${LIST_URL} — afgebroken (geen lege import).`)
  console.error('   Mogelijk blokkeert de site de scraper of is de pagina-structuur gewijzigd.')
  process.exit(1)
}

console.log(`📋 ${LIST_URL} → ${lots.length} lots`)

// ── Stap 2: per lot de detailpagina ophalen + parsen.
const horses = []
for (let i = 0; i < lots.length; i++) {
  const { id, lotNumber } = lots[i]
  const url = `${baseOrigin}/fr/selection-detail?id=${id}`
  process.stdout.write(`  [${i + 1}/${lots.length}] id=${id} ... `)
  try {
    const html = await fetchHtml(url)
    const lot = parseLot(html, id, url)
    lot.lot_number = lotNumber
    delete lot._id
    horses.push(lot)
    console.log(`${lot.name}${lotNumber ? ` (#${lotNumber})` : ''}`)
  } catch (e) {
    console.log(`❌ ${e.message}`)
  }
  await new Promise((r) => setTimeout(r, 500)) // nette pauze, geen hammering
}

if (horses.length === 0) {
  console.error('❌ Alle detailpagina’s faalden — geen lots om te importeren.')
  process.exit(1)
}

// Sorteer op lotnummer waar bekend, anders behoud volgorde.
horses.sort((a, b) => {
  if (a.lot_number != null && b.lot_number != null) return a.lot_number - b.lot_number
  if (a.lot_number != null) return -1
  if (b.lot_number != null) return 1
  return 0
})

// Datum uit de <title>.
const titleM = listHtml.match(/<title>([\s\S]*?)<\/title>/i)
const date = parseDateFromTitle(titleM ? titleM[1] : null)
if (!date) console.warn('⚠  Kon de datum niet uit de <title> halen — datum wordt overgeslagen.')

const meta = {
  collection: 'Extra Horses Megève 2026',
  house: 'Extra Horses',
  house_country: 'Frankrijk',
  website: LIST_URL,
  location: 'Megève, Frankrijk',
  status: 'planned',
  imported_at: new Date().toISOString(),
  total: horses.length,
  data_source: 'Extra Horses-scraper, venteexclusive.extrahorses.com',
}
if (date) meta.date = date

const out = { meta, horses }

await mkdir(dirname(OUT_FILE), { recursive: true })
await writeFile(OUT_FILE, JSON.stringify(out, null, 2))
console.log(`\n💾 Wrote ${OUT_FILE} (${horses.length} lots${date ? `, ${date}` : ''})`)
console.log(`\nNext: node --env-file=.env.local scripts/import-lots.mjs ${OUT_FILE}`)
