// Scraper voor Fences past auctions via hun 4D-API.
//
//   /4D-integrator/get-4D-Data-ajax.php
//
//   Liste_Ventes_Mois  → datums per jaar (met type)
//   liste_Ventes       → ventes per datum
//
// Iedere datum wordt een aparte collection.
//
// Gebruik:
//   node scripts/scrape-fences-ventes.mjs <year>      # 1 jaar
//   node scripts/scrape-fences-ventes.mjs all          # alle jaren 1998..NU

import { writeFile, mkdir } from 'node:fs/promises'

const BASE = 'https://www.fences.fr/wp-content/themes/Divi-child/4D-integrator/get-4D-Data-ajax.php'

async function call(param2, param3) {
  const u = new URL(BASE)
  u.searchParams.set('function', 'get_Website_PARAM')
  u.searchParams.append('data[param1]', '')
  u.searchParams.append('data[param2]', param2)
  u.searchParams.append('data[param3]', param3)
  u.searchParams.append('data[param4]', '')

  try {
    const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; veiling-pro)' } })
    const text = await res.text()
    if (!text.trim()) return null
    const env = JSON.parse(text)
    if (!env?.body) return null
    return JSON.parse(env.body)
  } catch (e) {
    console.warn(`   ⚠ ${param2}/${param3}: ${e.message}`)
    return null
  }
}

function genderToNL(g) {
  if (!g) return null
  const v = (g + '').toLowerCase()
  if (v.includes('hongre') || v === 'h')          return 'ruin'
  if (v.includes('jument') || v === 'f')          return 'merrie'
  if (v.includes('etalon') || v === 'm' || v.includes('étalon')) return 'hengst'
  return null
}

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function fetchYear(year) {
  console.log(`\n📅 Jaar ${year}`)
  const months = await call('Liste_Ventes_Mois', String(year))
  if (!months || !months.dates?.length) { console.log('   (geen ventes)'); return [] }
  console.log(`   ${months.dates.length} datums`)

  const collections = []
  for (const d of months.dates) {
    // d = { date: "DD/MM", type: "ELITE" | "PERF" | ... }
    const param3 = `${d.date.replace('/', '-')}-${year}`
    const ventes = await call('liste_Ventes', param3)
    if (!ventes || !ventes.ventes?.length) continue
    // Filter ventes met inhoud (Nom > "")
    const horses = ventes.ventes
      .filter((v) => v.Nom && v.Nom.trim())
      .map((v) => ({
        name: v.Nom.trim(),
        slug: slugify(v.Nom),
        discipline: 'Springen', // Fences = jumping
        sire: v.Nom_pere && v.Nom_pere !== 'inconnu' ? v.Nom_pere.trim() : null,
        dam:  v.Nom_mere && v.Nom_mere !== 'inconnu' ? v.Nom_mere.trim() : null,
        sale_price: typeof v.Prix === 'number' && v.Prix > 0 ? v.Prix : null,
        sold: typeof v.Prix === 'number' && v.Prix > 0,
        source_url: 'https://www.fences.fr/les-ventes-passees/',
      }))
    if (!horses.length) continue

    // Datum naar ISO. d.date "DD/MM" → "YYYY-MM-DD"
    const [dd, mm] = d.date.split('/')
    const iso = `${year}-${mm}-${dd}`

    collections.push({
      meta: {
        collection: `Fences ${d.type} — ${d.date}/${year}`,
        house: 'Agence Fences',
        date: iso,
        location: null,
        status: 'afgesloten',
        notes_organisatie: `Type: ${d.type}`,
        imported_at: new Date().toISOString(),
        total: horses.length,
        data_source: `Fences 4D-API, year=${year}, date=${param3}`,
      },
      horses,
    })
  }
  return collections
}

const arg = process.argv[2]
if (!arg) { console.error('Usage: node scripts/scrape-fences-ventes.mjs <year|all>'); process.exit(1) }

const years = arg === 'all'
  ? Array.from({ length: 2025 - 1998 + 1 }, (_, i) => 1998 + i)
  : [parseInt(arg, 10)]

const all = []
for (const y of years) {
  const colls = await fetchYear(y)
  all.push(...colls)
}

await mkdir('data', { recursive: true })
const outPath = `data/fences-ventes-${arg}.json`
await writeFile(outPath, JSON.stringify({ collections: all }, null, 2))
console.log(`\n💾 ${all.length} collecties → ${outPath}`)
const total = all.reduce((s, c) => s + c.horses.length, 0)
console.log(`🐎 ${total} totaal paarden`)
