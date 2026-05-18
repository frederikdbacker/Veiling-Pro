// Bron-registry + dispatcher voor collectie-import.
//
// Elke veilingsite-platform is één adapter-module met een vaste vorm:
//
//   export default {
//     id:        'horse24',                 // uniek, kebab-id
//     label:     'HORSE24',                 // leesbaar
//     hostnames: ['horse24.com', ...],      // bekende (white-label) domeinen
//     match(url)        -> boolean          // host-herkenning
//     sniff(html)       -> boolean          // inhoud-herkenning (fallback
//                                           //   voor onbekende white-label
//                                           //   domeinen)
//     scrape(url, opts) -> { meta, horses } // de eigenlijke scraper
//   }
//
// Zo herkent het systeem bij elke ingevoerde link de feitelijke pagina en
// roept het het juiste script aan. Specs per platform: zie README.md.

import horse24 from './horse24.mjs'
import weauction from './weauction.mjs'
import pwb from './pwb.mjs'
import zangersheide from './zangersheide.mjs'

export const SOURCES = [horse24, weauction, pwb, zangersheide]

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// Stap 1: herken op hostnaam (geen netwerk nodig).
export function resolveByHost(url) {
  const host = hostOf(url)
  return SOURCES.find(s => s.match?.(url) || s.hostnames?.some(h => host === h || host.endsWith(`.${h}`))) || null
}

// Stap 2: herken op pagina-inhoud (voor onbekende/white-label domeinen).
export function resolveBySniff(html) {
  return SOURCES.find(s => {
    try { return s.sniff?.(html) } catch { return false }
  }) || null
}

/**
 * Bepaal welke bron-adapter bij een URL hoort. Probeert eerst de host;
 * valt terug op een inhoud-sniff via één extra fetch.
 *
 * @returns {Promise<object>} de adapter
 * @throws  als geen enkele bekende bron matcht
 */
export async function resolveSource(url, { fetch = globalThis.fetch } = {}) {
  const byHost = resolveByHost(url)
  if (byHost) return byHost

  let html = ''
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'veiling-pro-import/1.0' } })
    if (r.ok) html = await r.text()
  } catch { /* genegeerd — val door naar de fout hieronder */ }

  const bySniff = html && resolveBySniff(html)
  if (bySniff) return bySniff

  const known = SOURCES.map(s => s.label).join(', ')
  throw new Error(
    `Onbekende veilingsite voor ${hostOf(url) || url}. ` +
    `Ondersteund: ${known}. Voeg een adapter toe in scripts/lib/sources/.`
  )
}
