// Adapter: HORSE24-platform (white-label: verdener-auktion-online.com,
// horse24.com, hannoveraner.horse24.com, …).
//
// De eigenlijke scraper-logica staat in ../horse24.mjs (Vue-props :auction /
// :lots / :lot + <pedigree-view>). Deze adapter is de dunne registratie-laag.

import { scrapeCollection } from '../horse24.mjs'

export default {
  id: 'horse24',
  label: 'HORSE24',
  hostnames: [
    'horse24.com',
    'verdener-auktion-online.com',
  ],
  match(url) {
    try {
      const host = new URL(url).hostname
      return host.includes('horse24') || host === 'verdener-auktion-online.com'
    } catch { return false }
  },
  // Werkt ook op onbekende white-label domeinen: de Vue-props zijn uniek.
  sniff(html) {
    return /:lots='\[/.test(html) || /<pedigree-view/.test(html) || /:auction='\{/.test(html)
  },
  scrape(url, opts) {
    return scrapeCollection(url, opts)
  },
}
