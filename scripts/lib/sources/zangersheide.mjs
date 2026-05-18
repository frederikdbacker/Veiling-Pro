// Adapter: Zangersheide.Auction (zangersheide.com). Server-rendered HTML.
//
//   collectie:  /<lang>/auctions/<auction-slug>
//                 → links naar /<lang>/auctions/<auction-slug>/<horse-slug>
//   detail:     bevat <div id="pedigree"> met de stamboom als platte
//               namenreeks: eerst de VADER-tak (15 namen, breadth-first),
//               daarna de MOEDER-tak (15 namen). Wij nemen er 3 generaties
//               uit in het DB-formaat (lots.pedigree).
//
// Let op: foto's worden client-side geladen — niet altijd uit de statische
// HTML te halen. Naam, afstamming (3 gen), geslacht en geboortejaar wel.

import { fetchText, stripTags, decodeEntities, bfsBranchToNode } from './util.mjs'

function infoValue(html, label) {
  const re = new RegExp(`>${label}</p>\\s*<p[^>]*>([\\s\\S]*?)</p>`, 'i')
  const m = re.exec(html)
  return m ? stripTags(m[1]) : null
}

function parsePedigree(html) {
  const i = html.indexOf('id="pedigree"')
  if (i === -1) return null
  const seg = html.slice(i, i + 14000)
  const names = (seg.match(/>([^<>]{2,60})</g) || [])
    .map(s => decodeEntities(s.replace(/[><]/g, '').trim()))
    .filter(n => n && n.toLowerCase() !== 'pedigree' && !/^&/.test(n))
  if (names.length < 14) return null
  const half = Math.floor(names.length / 2)
  const sire = bfsBranchToNode(names.slice(0, 7))
  const dam = bfsBranchToNode(names.slice(half, half + 7))
  if (!sire && !dam) return null
  return { sire, dam }
}

export default {
  id: 'zangersheide',
  label: 'Zangersheide',
  hostnames: ['zangersheide.com'],
  match(url) {
    try { return /zangersheide\.com$/.test(new URL(url).hostname.replace(/^www\./, '')) } catch { return false }
  },
  sniff(html) { return /Zangersheide\.Auction/.test(html) && /\/auctions\//.test(html) },

  async scrape(url, opts = {}) {
    const u = new URL(url)
    const origin = u.origin
    const overview = await fetchText(url, opts)

    // Veiling-slug uit de URL; verzamel unieke paard-slugs van de collectie.
    const aucSlug = u.pathname.replace(/\/$/, '').split('/').pop()
    const re = new RegExp(`/[a-z]{2}/auctions/${aucSlug}/([a-z0-9-]+)`, 'g')
    const slugs = [...new Set([...overview.matchAll(re)].map(m => m[1]))]

    const meta = {
      auction: decodeEntities(
        (/<meta property="og:title" content="([^"]+)"/.exec(overview)?.[1]
          || /<title>([^<]+)<\/title>/.exec(overview)?.[1] || 'Zangersheide')
          .split('|')[0].split(' - Ontdek')[0].trim()),
      website: origin,
      source_url: url,
      date: null,
      description: stripTags(/<meta name="description" content="([^"]+)"/.exec(overview)?.[1]),
      total: slugs.length,
    }

    let order = slugs
    if (opts.limit) order = order.slice(0, opts.limit)

    const horses = []
    let done = 0
    const queue = [...order.entries()]
    const conc = Math.min(opts.concurrency || 5, order.length || 1)
    async function worker() {
      while (queue.length) {
        const [i, slug] = queue.shift()
        const lotUrl = `${origin}/${u.pathname.split('/')[1] || 'nl'}/auctions/${aucSlug}/${slug}`
        try {
          const h = await fetchText(lotUrl, opts)
          const ogt = /<meta property="og:title" content="([^"]+)"/.exec(h)?.[1] || ''
          const [namePart] = ogt.split('|')
          const name = decodeEntities((namePart.split(' - ')[0] || slug).trim())
          const ped = parsePedigree(h)
          const birth = infoValue(h, 'Geboortedatum') || infoValue(h, 'Geboortejaar')
          const year = birth && /(\d{4})/.exec(birth)?.[1]
          horses[i] = {
            lot_number: i + 1,
            name,
            slug,
            discipline: null,
            year: year ? Number(year) : null,
            gender: infoValue(h, 'Geslacht'),
            size: null,
            studbook: infoValue(h, 'Stamboek') || 'Zangersheide',
            sire: ped?.sire?.name || null,
            dam: ped?.dam?.name || null,
            pedigree: ped,
            pedigree_raw: ped
              ? `V: ${ped.sire?.name ?? '?'} (${ped.sire?.sire?.name ?? '?'} × ${ped.sire?.dam?.name ?? '?'})\n`
                + `M: ${ped.dam?.name ?? '?'} (${ped.dam?.sire?.name ?? '?'} × ${ped.dam?.dam?.name ?? '?'})`
              : null,
            catalog_text: decodeEntities((namePart.split(' - ').slice(1).join(' - ')).trim()) || null,
            photos: [],
            video_url: (/youtube\.com\/embed\/([\w-]+)|youtu\.be\/([\w-]+)|i\.ytimg\.com\/vi\/([\w-]+)/.exec(h) || [])
              .slice(1).find(Boolean) ? `https://www.youtube.com/embed/${(/i\.ytimg\.com\/vi\/([\w-]+)|youtube\.com\/embed\/([\w-]+)|youtu\.be\/([\w-]+)/.exec(h) || []).slice(1).find(Boolean)}` : null,
            source_url: lotUrl,
            starting_bid: null,
            url_horsetelex: null,
            url_extra: null,
          }
        } catch {
          horses[i] = { lot_number: i + 1, name: decodeEntities(slug), slug, pedigree: null, photos: [], source_url: lotUrl }
        }
        opts.onProgress?.({ done: ++done, total: order.length, name: horses[i]?.name })
      }
    }
    await Promise.all(Array.from({ length: conc }, worker))
    return { meta, horses: horses.filter(Boolean) }
  },
}
