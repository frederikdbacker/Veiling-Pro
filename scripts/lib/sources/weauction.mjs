// Adapter: WeAuction-platform (white-label, o.a. bid.aloga-auction.com,
// ClipMyHorse-gerelateerd). Angular-SPA met JSON-API:
//
//   GET /api/auctions/{uuid}                          → veiling-meta
//   GET /api/auctions/{uuid}/items/published          → alle lots (paginated)
//                                                       ?page=1&pageSize=N
//
// De lijst bevat álle velden per lot (geen detailcall nodig). Afstamming:
// `subtitle` = "Vader x Moedervader" (1 generatie); `pedigreeGenerations`
// kan diepere data bevatten als de veiling die aanlevert; soms een PDF
// (`pedigreeFilePath`).

import { fetchJson, stripTags, absUrl, splitSireDam } from './util.mjs'

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function auctionId(url) {
  const m = UUID.exec(url)
  if (!m) throw new Error('Geen veiling-UUID in de WeAuction-URL gevonden')
  return m[0]
}

function photosOf(origin, it) {
  const out = []
  if (it.image?.imagePath) out.push(absUrl(origin, it.image.imagePath))
  for (const m of it.itemMedias || []) {
    if (m.imagePath && (m.mediaType === 0 || m.mediaType === 1)) out.push(absUrl(origin, m.imagePath))
  }
  return [...new Set(out.filter(Boolean))]
}

function videoOf(it) {
  for (const m of it.itemMedias || []) if (m.videoUrl) return m.videoUrl
  return null
}

export default {
  id: 'weauction',
  label: 'WeAuction (o.a. Aloga)',
  hostnames: ['aloga-auction.com', 'weauction.com', 'clipmyhorse.tv', 'clipmyhorse.com'],
  match(url) {
    try { return /aloga-auction|weauction|clipmyhorse/i.test(new URL(url).hostname) } catch { return false }
  },
  // WeAuction-shell is herkenbaar aan favicon-weauction + /api/tenant.
  sniff(html) { return /favicon-weauction|\/api\/tenant\//.test(html) },

  async scrape(url, opts = {}) {
    const origin = new URL(url).origin
    const id = auctionId(url)

    const auction = await fetchJson(`${origin}/api/auctions/${id}`, opts)
    const page = await fetchJson(
      `${origin}/api/auctions/${id}/items/published?page=1&pageSize=1000`, opts)
    const items = page.data || []

    const meta = {
      auction: (auction.name || '').trim(),
      website: origin,
      source_url: url,
      date: auction.startDateTime ? auction.startDateTime.slice(0, 10) : null,
      description: stripTags(auction.description),
      total: items.length,
    }

    let list = items
    if (opts.limit) list = list.slice(0, opts.limit)

    const horses = list.map((it, i) => {
      const { sire, dam } = splitSireDam(it.subtitle)
      // pedigreeGenerations is meestal leeg; subtitle geeft 1 generatie.
      const pedigree = (sire || dam) ? { sire: sire ? { name: sire, sire: null, dam: null } : null,
                                         dam: dam ? { name: dam, sire: null, dam: null } : null } : null
      opts.onProgress?.({ done: i + 1, total: list.length, name: it.name })
      return {
        lot_number: it.orderNumber ?? null,
        name: (it.name || '').trim() || null,
        slug: null,
        discipline: null,
        year: null,
        gender: null,
        size: null,
        studbook: null,
        sire, dam,
        pedigree,
        pedigree_raw: it.subtitle || null,
        catalog_text: stripTags(it.description),
        photos: photosOf(origin, it),
        video_url: videoOf(it),
        source_url: `${origin}/auctions/${id}`,
        starting_bid: it.startingAmount ?? null,
        url_horsetelex: null,
        url_extra: it.pedigreeFilePath ? absUrl(origin, it.pedigreeFilePath) : (it.pedigreeUrl || null),
      }
    })

    return { meta, horses }
  },
}
