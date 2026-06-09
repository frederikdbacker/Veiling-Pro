// Update de Fences SERVICE — 19/06/2026 lots met foto-URL's.
// Run éénmalig: node --env-file=.env.local scripts/update-fences-service-2026-photos.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) { console.error('❌ env vars'); process.exit(1) }
const supabase = createClient(url, key)

// lot_number → photo URL (full-size, parsed van /cheval/vente/service/)
const photos = {
   1: 'https://extranetfences.com/upload/ged/12449/97C806F8C6B86D4A8791AFECB394D989/3632003772FC6E45A2BB47B4AB2EF84A.jpg',
   2: 'https://extranetfences.com/upload/ged/12450/97C806F8C6B86D4A8791AFECB394D989/CFF874E8AD78584FBC0BAFEF8F4ABD85.jpg',
   3: 'https://extranetfences.com/upload/ged/12426/97C806F8C6B86D4A8791AFECB394D989/4B9F6C3654006A4BA23D425AF227F9AD.png',
   4: 'https://extranetfences.com/upload/ged/12443/97C806F8C6B86D4A8791AFECB394D989/EA0AC7E8F20E0A4D9613858D5C01C70D.png',
   5: 'https://extranetfences.com/upload/ged/12428/97C806F8C6B86D4A8791AFECB394D989/BE830E16A7609B48BB278E0B122E6BF2.png',
   6: 'https://extranetfences.com/upload/ged/12438/44A6F68AEDB66E4E9FF9640AE98BEC3A/A6999C71B6B491479E559344E44A5D93.png',
   7: 'https://extranetfences.com/upload/ged/12429/97C806F8C6B86D4A8791AFECB394D989/F41B5B600271E84AA36DA87D69C9C38D.png',
   8: 'https://extranetfences.com/upload/ged/12444/44A6F68AEDB66E4E9FF9640AE98BEC3A/FE18042E968C5442AC2B6E96E3CD08CF.png',
   9: 'https://extranetfences.com/upload/ged/12430/97C806F8C6B86D4A8791AFECB394D989/0CD3E8BE59CFC54B998576445B1174CE.png',
  10: 'https://extranetfences.com/upload/ged/12439/44A6F68AEDB66E4E9FF9640AE98BEC3A/338F065522C00C4C9886A583C2BE36EF.png',
  11: 'https://extranetfences.com/upload/ged/12431/97C806F8C6B86D4A8791AFECB394D989/BA9B827EBD05B34881EAA3023703C634.png',
  12: 'https://extranetfences.com/upload/ged/12432/97C806F8C6B86D4A8791AFECB394D989/79B2E7F032EDF141AEBA75A33E1D6090.png',
  13: 'https://extranetfences.com/upload/ged/12440/44A6F68AEDB66E4E9FF9640AE98BEC3A/530AB0E1D1CC2F4CB238393B58664833.png',
  14: 'https://extranetfences.com/upload/ged/12451/97C806F8C6B86D4A8791AFECB394D989/72318DA53EA1CF44AB5FF71390168828.jpg',
  15: 'https://extranetfences.com/upload/ged/12452/97C806F8C6B86D4A8791AFECB394D989/4EDF00F0EBE63E4899AA48D32EEBBC83.jpg',
  16: 'https://extranetfences.com/upload/ged/12433/97C806F8C6B86D4A8791AFECB394D989/8A9A2FEA14D7C44A8A64AEC114BA26E6.png',
  17: 'https://extranetfences.com/upload/ged/12445/44A6F68AEDB66E4E9FF9640AE98BEC3A/BB6B0B27C1CF724492DBBCCCEBC1E89B.png',
  18: 'https://extranetfences.com/upload/ged/12434/97C806F8C6B86D4A8791AFECB394D989/D59D404358619C4A8FFC63564A3EDEF6.png',
  19: 'https://extranetfences.com/upload/ged/12446/44A6F68AEDB66E4E9FF9640AE98BEC3A/952E4E47399C1F4094D0F7A7B740C4CC.png',
  20: 'https://extranetfences.com/upload/ged/12435/97C806F8C6B86D4A8791AFECB394D989/23A6D494A1E01C41BDF9B8CE4B123432.png',
  21: 'https://extranetfences.com/upload/ged/12441/44A6F68AEDB66E4E9FF9640AE98BEC3A/E9AA19126D1A0346A9CD89590530583B.png',
  22: 'https://extranetfences.com/upload/ged/12436/97C806F8C6B86D4A8791AFECB394D989/270C4D659F1ED44382518D9F4CD7B91C.png',
  23: 'https://extranetfences.com/upload/ged/12447/44A6F68AEDB66E4E9FF9640AE98BEC3A/F0627957076DDA4E8051CCAE18F1FD68.png',
  24: 'https://extranetfences.com/upload/ged/12281/97C806F8C6B86D4A8791AFECB394D989/F6473A540F55B74C91607FCB605AA351.png',
  25: 'https://extranetfences.com/upload/ged/12437/97C806F8C6B86D4A8791AFECB394D989/5903F2F32E64B445B82CD923FD26273D.png',
  26: 'https://extranetfences.com/upload/ged/12442/44A6F68AEDB66E4E9FF9640AE98BEC3A/390D2A12F05AD54BAD6785D997F8FF77.png',
}

// 1) collection ophalen — ID hardcoded want naam is handmatig aangepast
const { data: coll, error: cErr } = await supabase
  .from('collections')
  .select('id, name')
  .eq('id', 'cdcf6ff4-a374-42d4-92d6-dc1207a99de2')
  .single()
if (cErr) { console.error('❌ collection:', cErr.message); process.exit(1) }
console.log(`🎯 ${coll.name} (${coll.id})`)

// 2) lots ophalen
const { data: lots, error: lErr } = await supabase
  .from('lots')
  .select('id, number, name, photos')
  .eq('collection_id', coll.id)
  .order('number')
if (lErr) { console.error('❌ lots:', lErr.message); process.exit(1) }
console.log(`📦 ${lots.length} lots`)

// 3) per lot photos updaten
let updated = 0
for (const lot of lots) {
  const url = photos[lot.number]
  if (!url) { console.warn(`⚠  lot ${lot.number} ${lot.name}: geen foto in map`); continue }
  const { error } = await supabase
    .from('lots')
    .update({ photos: [url] })
    .eq('id', lot.id)
  if (error) { console.error(`❌ lot ${lot.number}: ${error.message}`); continue }
  console.log(`   ${String(lot.number).padStart(2)}. ${lot.name} ← foto`)
  updated++
}
console.log(`\n✅ ${updated}/${lots.length} lots geüpdatet met foto`)
