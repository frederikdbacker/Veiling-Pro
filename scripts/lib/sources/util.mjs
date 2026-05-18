// Gedeelde helpers voor bron-adapters (geen externe dependencies).

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

export function decodeEntities(s) {
  if (!s) return s
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, b) => {
    if (b[0] === '#') {
      const c = b[1] === 'x' || b[1] === 'X' ? parseInt(b.slice(2), 16) : parseInt(b.slice(1), 10)
      return Number.isFinite(c) ? String.fromCodePoint(c) : m
    }
    return b in NAMED ? NAMED[b] : m
  })
}

export function stripTags(html) {
  if (html == null) return null
  const t = decodeEntities(
    String(html)
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
  return t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim() || null
}

export async function fetchText(url, opts = {}) {
  const fetchFn = opts.fetch || globalThis.fetch
  const r = await fetchFn(url, { headers: { 'User-Agent': 'veiling-pro-import/1.0', Accept: 'text/html,application/json', ...(opts.headers || {}) } })
  if (!r.ok) throw new Error(`HTTP ${r.status} bij ${url}`)
  return r.text()
}

export async function fetchJson(url, opts = {}) {
  const fetchFn = opts.fetch || globalThis.fetch
  const r = await fetchFn(url, { headers: { 'User-Agent': 'veiling-pro-import/1.0', Accept: 'application/json', ...(opts.headers || {}) } })
  if (!r.ok) throw new Error(`HTTP ${r.status} bij ${url}`)
  return r.json()
}

export function absUrl(base, path) {
  if (!path) return null
  try { return new URL(path, base).href } catch { return path }
}

// "Sire x Damsire" / "Sire × Dam" → { sire, dam }
export function splitSireDam(s) {
  if (!s) return { sire: null, dam: null }
  const m = String(s).split(/\s*[x×]\s*/i)
  return { sire: (m[0] || '').trim() || null, dam: (m[1] || '').trim() || null }
}

// Bouw de geneste 3-generatie-boom (DB-formaat lots.pedigree) uit een
// breadth-first namenlijst per tak: [root, g2s, g2d, g3ss, g3sd, g3ds, g3dd].
export function bfsBranchToNode(b) {
  if (!b || !b[0]) return null
  const g2 = (name, s, d) => (name || s || d ? { name: name || null, sire: s || null, dam: d || null } : null)
  return {
    name: b[0] || null,
    sire: g2(b[1], b[3], b[4]),
    dam: g2(b[2], b[5], b[6]),
  }
}
