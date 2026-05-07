// Importeer Fences-associés in house_committee_members.

import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY)

// 1. Vind het Fences-huis (heet "Agence Fences" in de DB)
const { data: house, error: hErr } = await sb
  .from('auction_houses')
  .select('id, name')
  .ilike('name', '%fences%')
  .single()
if (hErr || !house) { console.error('❌ Fences-huis niet gevonden'); process.exit(1) }
console.log(`🏠 ${house.name} (${house.id})`)

// 2. Render de pagina
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
await page.goto('https://www.fences.fr/associes/', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise((r) => setTimeout(r, 2500))
await page.evaluate(async () => {
  await new Promise((resolve) => {
    let h = 0
    const t = setInterval(() => {
      window.scrollBy(0, 500); h += 500
      if (h >= document.body.scrollHeight) { clearInterval(t); resolve() }
    }, 250)
  })
})
await new Promise((r) => setTimeout(r, 2000))

// 3. Extract per associé-blok: image + tekst (voorkomt cross-talk tussen blokken)
const raw = await page.evaluate(() => {
  // Iedere associé heeft <img class="image"> binnen een module-container.
  // Klim op tot het kleinste blok dat ook tekst bevat.
  const imgs = [...document.querySelectorAll('img.image')]
  return imgs.map((img) => {
    let el = img
    for (let i = 0; i < 6; i++) {
      el = el.parentElement
      if (!el) break
      const t = el.textContent.trim()
      if (t.length > 20 && t.length < 500) break
    }
    return {
      src: img.currentSrc || img.src,
      text: el?.textContent.replace(/\s+/g, ' ').trim() || '',
    }
  })
})
await browser.close()

console.log(`📋 ${raw.length} associé-blokken`)

// 4. Parse naam + role uit tekst
//    Format: "<Voornaam> ACHTERNAAM <Role[ fondateur|d'honneur|à jamais...]> [email] [phone]"
function parseEntry(rawText) {
  // Strip eventuele HTML-tags (Divi blijkt soms innerHTML te leveren via textContent).
  const text = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const m = text.match(/^(.+?)\s+(Associée?|Présidente?(?:\s+d['’]honneur)?)((?:\s+(?:fondateur|fondatrice|à jamais[^A-Z@+]+))?)\s*(.*)$/u)
  if (!m) return { name: text.split(/\s+@/)[0].trim(), role: null }
  const fullName = m[1].trim()
  const baseRole = m[2].trim()
  const roleSuffix = m[3].trim()
  const role = (baseRole + (roleSuffix ? ' ' + roleSuffix : '')).trim()
  return { name: fullName, role }
}

const members = raw.map((r, i) => {
  const { name, role } = parseEntry(r.text)
  return { name, role, photo_url: r.src, display_order: i }
}).filter((m) => m.name && m.name.length < 80)

console.log()
for (const m of members) {
  console.log(`  ${m.name.padEnd(28)} | ${m.role || '?'}`)
}

// 5. Upsert
let inserted = 0, updated = 0
for (const m of members) {
  const { data: existing } = await sb
    .from('house_committee_members')
    .select('id')
    .eq('house_id', house.id)
    .eq('name', m.name)
    .maybeSingle()

  if (existing) {
    const { error: e } = await sb.from('house_committee_members').update({
      role: m.role, photo_url: m.photo_url, display_order: m.display_order,
    }).eq('id', existing.id)
    if (e) console.error(` ⚠ ${m.name}: ${e.message}`); else updated++
  } else {
    const { error: e } = await sb.from('house_committee_members').insert({
      house_id: house.id, ...m,
    })
    if (e) console.error(` ⚠ ${m.name}: ${e.message}`); else inserted++
  }
}
console.log(`\n✅ ${inserted} nieuw, ${updated} geüpdatet`)
