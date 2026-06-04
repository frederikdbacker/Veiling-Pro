// Olympic Dream Auction-scraper (Jumping Schröder Twente — Jimdo-site).
//
// De pagina is een Jimdo-website (jw-*-classes). Elk paard staat als een
// `jw-image-text`-blok met een tekstkolom (Vader / X Moeder / geslacht /
// geboortedatum of jaar / kleur / stamboek) + een foto + twee knoppen
// (HORSE TELEX → afstammingslink, YOU TUBE → video).
//
// Belangrijk: de paarden hebben op de pagina GEEN eigen naam (alleen
// "Vader x Moeder"). De échte geregistreerde naam zit in de Horse Telex-URL
// (laatste pad-segment, bv. .../3037641/womanizer-ebs → "Womanizer EBS").
// Daar leiden we de naam uit af; bij een onvolledige slug ("g") vallen we
// terug op "Vader x Moeder".
//
// Schrijft data/olympic-dream-auction.json; daarna laadt
// scripts/import-lots.mjs dit in Supabase (leidt lot_type_id zelf af:
// veulens geboren in 2026 → Veulen, oudere paarden → Springpaard).
//
// Gebruik:
//   node scripts/scrape-olympic-dream-auction.mjs

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const PAGE_URL = 'https://www.jumpingschrodertwente.nl/olympic-dream-auction'

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; veiling-pro-scraper)' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.text()
}

function decodeEntities(s) {
  if (!s) return s
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
}

// Geslacht → Nederlands, consistent met bestaande lots (Hengst/Merrie/Ruin).
const GENDER_NL = {
  colt: 'Hengst', filly: 'Merrie', gelding: 'Ruin', mare: 'Merrie',
  stallion: 'Hengst', stute: 'Merrie', wallach: 'Ruin', hengst: 'Hengst',
  merrie: 'Merrie', ruin: 'Ruin',
}
const GENDER_RE = /^(colt|filly|gelding|mare|stallion|stute|wallach|hengst|merrie|ruin)$/i

// Kleur → Nederlands (voor de catalogustekst).
const COLOR_NL = {
  brown: 'bruin', bay: 'bruin', darkbrown: 'donkerbruin', grey: 'schimmel',
  gray: 'schimmel', chestnut: 'vos', black: 'zwart',
}
const COLOR_RE = /^(brown|bay|darkbrown|grey|gray|chestnut|black)$/i
const STUDBOOK_RE = /kwpn|zangersheide|bwp|selle|holstein|hann|oldenburg|sbs|aes|nrps/i

// Afkortingen die in paardennamen volledig in hoofdletters blijven.
const UPPER_TOKENS = new Set(['z', 'sv', 'vdh', 'vdl', 'ebs', 'tn', 'ps', 'em', 'es', 'vd', 'sa'])

function nameFromTelex(url) {
  if (!url) return null
  const slug = (url.match(/\/pedigree\/\d+\/([^/?#]+)/) || [])[1]
  if (!slug) return null
  const name = slug.split('-').map(t =>
    UPPER_TOKENS.has(t.toLowerCase()) ? t.toUpperCase()
      : t.charAt(0).toUpperCase() + t.slice(1)
  ).join(' ').trim()
  return name.length < 2 ? null : name
}

const html = await fetchHtml(PAGE_URL)

// Anker op elk tekstblok; per blok een venster vooruit (voor links) en
// achteruit (voor de bijbehorende foto) bekijken.
const marker = /jw-element-imagetext-text/g
const starts = []
let m
while ((m = marker.exec(html)) !== null) starts.push(m.index)

const horses = []
let lotNumber = 0

for (let i = 0; i < starts.length; i++) {
  const start = starts[i]
  const forward = html.slice(start, starts[i + 1] ?? start + 6000)
  const backward = html.slice(Math.max(0, start - 4000), start)

  // Tekstfragmenten in dit blok (tags → scheidingsteken, dan opsplitsen).
  const inner = (forward.match(/jw-element-imagetext-text">([\s\S]*?)<\/div>/) || [])[1] || ''
  const frags = decodeEntities(inner.replace(/<[^>]+>/g, '\n'))
    .split('\n').map(s => s.trim()).filter(Boolean)

  // Links: Horse Telex (afstamming/naam) + YouTube (video).
  const links = [...forward.matchAll(/href="([^"]+)"/g)].map(a => decodeEntities(a[1]))
  const telex = links.find(l => /horsetelex/i.test(l)) || null
  const video = links.find(l => /youtu/i.test(l)) || null

  // Een echt paard-blok heeft een geslacht-fragment én een Horse Telex-link.
  const genderFrag = frags.find(f => GENDER_RE.test(f))
  if (!genderFrag || !telex) continue   // sla koppen (FOALS/HORSES) + footer over

  // Classificeer de overige fragmenten.
  const damFrag = frags.find(f => /^x\s+/i.test(f))
  const dam = damFrag ? damFrag.replace(/^x\s+/i, '').trim() : null
  // Vader = eerste fragment dat geen X-regel/geslacht/datum/kleur/stamboek/knop is.
  const sire = frags.find(f =>
    f !== damFrag && f !== genderFrag &&
    !/^x\s+/i.test(f) &&
    !/^\d/.test(f) &&
    !COLOR_RE.test(f) &&
    !STUDBOOK_RE.test(f) &&
    !/horse\s*telex|you\s*tube/i.test(f)
  ) || null

  const dateFrag = frags.find(f => /^\d{2}-\d{2}-\d{4}$/.test(f))   // veulen: geboortedatum
  const yearOnly = frags.find(f => /^\d{4}$/.test(f))              // paard: geboortejaar
  const year = dateFrag ? Number(dateFrag.slice(-4)) : (yearOnly ? Number(yearOnly) : null)

  const colorFrag = frags.find(f => COLOR_RE.test(f))
  const color = colorFrag ? COLOR_NL[colorFrag.toLowerCase()] || colorFrag.toLowerCase() : null
  const studFrag = frags.find(f => STUDBOOK_RE.test(f))
  const studbook = studFrag ? studFrag.replace(/horse\s*telex|you\s*tube/ig, '').trim() : null

  const gender = GENDER_NL[genderFrag.toLowerCase()] || genderFrag

  // Foto: laatste jwwb-afbeelding vóór dit tekstblok.
  const imgs = [...backward.matchAll(/<img[^>]+src="([^"]+)"/g)]
    .map(a => decodeEntities(a[1]))
    .filter(src => /jwwb\.nl/i.test(src) && !/logo/i.test(src))
  const photo = imgs.length ? imgs[imgs.length - 1] : null

  const name = nameFromTelex(telex) || [sire, dam].filter(Boolean).join(' x ') || null

  // Catalogustekst: geboortedatum (veulens) + kleur, in gewone taal.
  const catalogParts = []
  if (dateFrag) catalogParts.push(`Geboren ${dateFrag}`)
  if (color) catalogParts.push(`kleur ${color}`)
  const catalog_text = catalogParts.length ? catalogParts.join(', ') + '.' : null

  lotNumber += 1
  horses.push({
    lot_number: lotNumber,
    name,
    discipline: null,
    year,
    gender,
    size: null,
    studbook,
    sire,
    dam,
    pedigree: (sire || dam) ? {
      sire: sire ? { name: sire, sire: null, dam: null } : null,
      dam: dam ? { name: dam, sire: null, dam: null } : null,
    } : null,
    pedigree_raw: [sire, dam].filter(Boolean).join(' x ') || null,
    catalog_text,
    photos: photo ? [photo] : [],
    video_url: video,
    url_horsetelex: telex,
    source_url: PAGE_URL,
    starting_bid: null,
  })
}

console.log(`✅ Scraped ${horses.length} paarden`)
for (const h of horses) {
  console.log(`   ${String(h.lot_number).padStart(2)}. ${h.name}  —  ${h.sire} x ${h.dam}  (${h.gender}, ${h.year ?? '?'}, ${h.studbook ?? '?'})`)
}

const output = {
  meta: {
    // Exact gelijk aan de bestaande, lege collectie 725747f9 zodat de
    // upsert in import-lots.mjs daarin landt (geen nieuwe collectie/huis).
    collection: 'Olympic Dream Auction',
    house: 'Olympic Dream Auctions',
    website: PAGE_URL,
    location: 'Jumping Schröder Tubbergen',
    status: 'planned',
    imported_at: new Date().toISOString(),
    total: horses.length,
    data_source: 'Olympic Dream Auction-scraper, jumpingschrodertwente.nl',
  },
  horses,
}

const outPath = 'data/olympic-dream-auction.json'
await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, JSON.stringify(output, null, 2))
console.log(`\n💾 Wrote ${outPath}`)
console.log(`Next: node --env-file=.env.local scripts/import-lots.mjs ${outPath}`)
