// Importeer een veilingcollectie rechtstreeks vanuit een HORSE24-URL.
//
// Gebruik:
//   node --env-file=.env.local scripts/import-from-url.mjs <auction-url> \
//        [--name "Verden Auction YoungSTARS OnLive"] \
//        [--house Verden] [--location Verden] [--date 2026-05-30] \
//        [--status planned] [--no-enrich]
//
// Voorbeeld (Verden):
//   node --env-file=.env.local scripts/import-from-url.mjs \
//     "https://verdener-auktion-online.com/de/auctions/details/verdener-auktion-onlive-youngstars-2026-135" \
//     --name "Verden Auction YoungSTARS OnLive" --house Verden --location Verden \
//     --date 2026-05-30 --status planned

import { createClient } from '@supabase/supabase-js'
import { importCollection } from './lib/import-collection.mjs'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Env ontbreekt. Run met: node --env-file=.env.local scripts/import-from-url.mjs <url>')
  process.exit(1)
}

const argv = process.argv.slice(2)
const url = argv.find(a => !a.startsWith('--'))
if (!url) {
  console.error('Usage: node --env-file=.env.local scripts/import-from-url.mjs <auction-url> [--name …] [--house …] [--location …] [--date …] [--status …] [--no-enrich]')
  process.exit(1)
}

function opt(flag) {
  const i = argv.indexOf(flag)
  return i !== -1 ? argv[i + 1] : undefined
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

console.log(`🌐 ${url}`)
const result = await importCollection({
  supabase,
  url,
  name: opt('--name'),
  house: opt('--house'),
  location: opt('--location'),
  date: opt('--date'),
  status: opt('--status') || 'planned',
  lotTypeKey: opt('--lot-type') || 'foal',
  // bv. --update-existing pedigree,pedigree_raw,sire,dam
  updateExisting: opt('--update-existing')?.split(',').map(s => s.trim()).filter(Boolean),
  enrich: !argv.includes('--no-enrich'),
  onProgress: p => {
    if (p.phase === 'enrich') process.stdout.write(`\r  verrijken ${p.done}/${p.total}   `)
    else if (p.message) console.log(p.message)
  },
}).catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1) })

const c = result.collection
console.log(`\n🏛  Huis:       ${result.house.name} (${result.house.id})`)
console.log(`🎯 Collection: ${c.name} (${c.id})${result.collection_created ? ' [nieuw]' : ' [bestond al]'}`)
console.log(`📅 ${c.date || '—'} · ${c.location || '—'} · ${c.status}`)
console.log(`✅ ${result.inserted} nieuw · ${result.updated} bijgewerkt · ${result.skipped} ongemoeid · ${result.total} in collectie`)
