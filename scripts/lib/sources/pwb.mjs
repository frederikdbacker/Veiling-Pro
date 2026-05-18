// Adapter: PWB-platform (white-label CMS, o.a. horseauctionbelgium.com en
// paardenveilingonline.com). Server-rendered Bootstrap-HTML.
//
// De volledige collectie staat op de collectiepagina /collectie/{id} als
// kaarten (.card-collection) — er is GEEN per-paard detailpagina. De
// afstamming staat enkel als "Vader x Moedervader" op de kaart (1 generatie).
// De exacte HTML rond die "x" verschilt per white-label
// (`<small><b>x</b></small>` vs `<span class="text-secondary">x</span>`),
// daarom wordt de tekst tag-onafhankelijk geparset.

import { fetchText, stripTags, decodeEntities, absUrl } from './util.mjs'

const GENDERS = /\b(merrie|hengst|ruin|stallion|mare|gelding|colt|filly|stute|wallach)\b/i

// Ruwe inner-HTML van het element met class `cls` (p, h1-6 of div).
function rawField(seg, cls) {
  const m = new RegExp(
    `<(p|h[1-6]|div)[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1>`, 'i'
  ).exec(seg)
  return m ? m[2] : null
}

function field(seg, cls) {
  return stripTags(rawField(seg, cls))
}

// PWB scheidt vader/moedervader met een GETAGDE x
// (`<small><b>x</b></small>` of `<span class="text-secondary">x</span>`),
// niet met een kale letter — anders matcht de "x" in "Nixon".
function sireDamFromPedigree(rawHtml) {
  if (!rawHtml) return { sire: null, dam: null }
  const parts = rawHtml.split(/<(small|span|b|strong)[^>]*>\s*[x×]\s*<\/\1>/i)
  if (parts.length >= 3) {
    return { sire: stripTags(parts[0]) || null, dam: stripTags(parts[parts.length - 1]) || null }
  }
  // Fallback: alleen splitsen op " x " mét spaties eromheen.
  const t = stripTags(rawHtml) || ''
  const m = t.split(/\s+[x×]\s+/)
  return { sire: (m[0] || '').trim() || null, dam: (m[1] || '').trim() || null }
}

export default {
  id: 'pwb',
  label: 'PWB (Horse Auction Belgium / Paardenveilingonline)',
  hostnames: ['horseauctionbelgium.com', 'paardenveilingonline.com'],
  match(url) {
    try { return /horseauctionbelgium\.com|paardenveilingonline\.com/i.test(new URL(url).hostname) } catch { return false }
  },
  // PWB-kenmerk: collectie-kaarten met .horsepedigree binnen /collectie/.
  sniff(html) { return /class="[^"]*horsepedigree/.test(html) && /card-collection/.test(html) },

  async scrape(url, opts = {}) {
    const origin = new URL(url).origin
    const html = await fetchText(url, opts)

    const ogTitle = /<meta property="og:title" content="([^"]+)"/.exec(html)?.[1]
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1]
    const meta = {
      auction: decodeEntities((ogTitle || title || new URL(url).hostname).split('|')[0].trim()),
      website: origin,
      source_url: url,
      date: null,
      description: stripTags(/<meta name="description" content="([^"]+)"/.exec(html)?.[1]),
      total: 0,
    }

    // Splits op kaarten; binnen elk segment komen de velden in vaste volgorde.
    const segments = html.split(/class="[^"]*card-collection[^"]*"/i).slice(1)
    let horses = segments.map((seg) => {
      const nameRaw = field(seg, 'horsename') || ''
      const nm = /^\s*(\d+)\s*[.)]\s*(.+)$/.exec(nameRaw)
      const lot_number = nm ? Number(nm[1]) : null
      const name = (nm ? nm[2] : nameRaw).trim() || null

      const { sire, dam } = sireDamFromPedigree(rawField(seg, 'horsepedigree'))
      const info = field(seg, 'horseinfo') || ''
      const year = /[°˚∘]?\s*(\d{4})/.exec(info)?.[1]
      const gender = GENDERS.exec(info)?.[1] || null

      const img = /<img[^>]+src="([^"]+)"[^>]*class="[^"]*card-img/i.exec(seg)?.[1]
      const slogan = field(seg, 'horseslogan')

      const pedigree = (sire || dam) ? {
        sire: sire ? { name: sire, sire: null, dam: null } : null,
        dam: dam ? { name: dam, sire: null, dam: null } : null,
      } : null

      return {
        lot_number,
        name,
        slug: null,
        discipline: null,
        year: year ? Number(year) : null,
        gender,
        size: null,
        studbook: null,
        sire, dam,
        pedigree,
        pedigree_raw: [sire, dam].filter(Boolean).join(' x ') || null,
        catalog_text: slogan,
        photos: img ? [absUrl(origin, decodeEntities(img))] : [],
        video_url: null,
        source_url: url,
        starting_bid: null,
        url_horsetelex: null,
        url_extra: null,
      }
    }).filter(h => h.name)

    if (opts.limit) horses = horses.slice(0, opts.limit)
    meta.total = horses.length
    horses.forEach((h, i) => opts.onProgress?.({ done: i + 1, total: horses.length, name: h.name }))
    return { meta, horses }
  },
}
