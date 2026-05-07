// Importeer de teamleden van Aloga vanaf https://www.aloga-auction.com/team
// in house_committee_members. Foto's worden gedownload en geüpload naar
// Supabase Storage bucket "client-photos" onder /committee/aloga/.

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const sb = createClient(url, key)

// 1. Aloga huis
const { data: house, error: hErr } = await sb
  .from('auction_houses')
  .select('id, name')
  .eq('name', 'Aloga Auction')
  .single()
if (hErr || !house) { console.error('❌ Aloga-huis niet gevonden'); process.exit(1) }
console.log(`🏠 ${house.name} (${house.id})`)

// 2. Scrape de team-pagina
const teamHtml = await (await fetch('https://www.aloga-auction.com/team', {
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; veiling-pro)' },
})).text()

// Vind alle <img src="...uploads/team/..." alt="NAAM">
const imgRe = /<img\s+src="([^"]*\/uploads\/team\/[^"]+)"\s+alt="([^"]+)"/g
const showjumpIdx = teamHtml.indexOf('SHOWJUMPING')
const dressageIdx = teamHtml.indexOf('DRESSAGE')

const seen = new Set()
const members = []
let m
while ((m = imgRe.exec(teamHtml)) !== null) {
  const name = m[2].trim()
  if (seen.has(name)) continue
  seen.add(name)
  // src kan absoluut of relatief zijn — normaliseer
  const photoSrc = m[1].startsWith('http') ? m[1] : `https://www.aloga-auction.com${m[1]}`
  const role = (m.index < dressageIdx) ? 'Showjumping' : 'Dressage'
  members.push({ name, role, photoSrc })
}

console.log(`👥 ${members.length} teamleden gevonden:`)
for (const x of members) console.log(`   - ${x.name} (${x.role})`)

// 3. Upsert per lid — externe URL direct gebruiken (geen Storage-upload nodig)
let inserted = 0
for (let i = 0; i < members.length; i++) {
  const m = members[i]
  try {
    const photoUrl = m.photoSrc
    // Bestaat al?
    const { data: existing } = await sb
      .from('house_committee_members')
      .select('id')
      .eq('house_id', house.id)
      .eq('name', m.name)
      .maybeSingle()

    if (existing) {
      await sb.from('house_committee_members').update({
        role: m.role, photo_url: photoUrl, display_order: i,
      }).eq('id', existing.id)
      console.log(`  ↻ ${m.name}`)
    } else {
      await sb.from('house_committee_members').insert({
        house_id: house.id, name: m.name, role: m.role,
        photo_url: photoUrl, display_order: i,
      })
      console.log(`  + ${m.name}`)
      inserted++
    }
  } catch (e) {
    console.error(`  ⚠ ${m.name}: ${e.message}`)
  }
}

console.log(`\n✅ Klaar — ${inserted} nieuwe leden, rest geüpdatet`)
