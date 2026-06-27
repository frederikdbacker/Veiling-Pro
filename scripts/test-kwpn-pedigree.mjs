// Offline robuustheidstest voor de KWPN pedigree-driehoek-parser
// (scripts/lib/kwpn.mjs · parsePedigree). Geen netwerk.
//
//   node scripts/test-kwpn-pedigree.mjs
//
// De live KWPN Select Sale-collecties hebben allemaal een VOLLEDIGE 3-generatie-
// stamboom (8 rijen / 14 cellen). Maar niet elke veiling is dat (veulen-/embryo-/
// broodmare-collecties kunnen onvolledig zijn). Deze test bewijst dat de parser
// op GEOMETRIE werkt (kolom = generatie, rij/rowspan = positie) en dus bij gaten
// een PARTIËLE boom teruggeeft — ontbrekende of blanco voorouders worden `null`,
// nooit een crash of een verschuiving (een aanwezige voorouder die in een leeg
// vakje schuift).

import { parsePedigree } from './lib/kwpn.mjs'

let failures = 0
const check = (name, cond) => { if (cond) console.log(`  ✓ ${name}`); else { console.error(`  ✗ ${name}`); failures++ } }

// ── 1) volledige driehoek (zoals een echt KWPN Select Sale-lot) ───────────────
const FULL = `<table class="table table-pedigree triangle-left">
<tr><td rowspan="4" class="highlight">FATHER<br></td><td rowspan="2">FS<br>ERKEND</td><td>FSS<br>STB PREFERENT</td></tr>
<tr><td>FSD<br>STB ELITE</td></tr>
<tr><td rowspan="2">FD<br></td><td>FDS<br></td></tr>
<tr><td>FDD<br></td></tr>
<tr><td rowspan="4">MOTHER<br></td><td rowspan="2" class="highlight">MS<br></td><td>MSS<br>STB KEUR</td></tr>
<tr><td>MSD<br></td></tr>
<tr><td rowspan="2">MD<br></td><td>MDS<br></td></tr>
<tr><td>MDD<br></td></tr>
</table>`
{
  const { pedigree } = parsePedigree(FULL)
  check('volledig: vader = FATHER', pedigree.sire.name === 'FATHER')
  check('volledig: moeder = MOTHER (echte moeder)', pedigree.dam.name === 'MOTHER')
  check('volledig: VV = FS, VVV = FSS', pedigree.sire.sire.name === 'FS' && pedigree.sire.sire.sire === 'FSS')
  check('volledig: MM = MD, MMM = MDD', pedigree.dam.dam.name === 'MD' && pedigree.dam.dam.dam === 'MDD')
  check('volledig: predicaat ("ERKEND") niet in de naam', pedigree.sire.sire.name === 'FS')
}

// ── 2) onvolledig: enkel ouders + grootouders (gen3 ontbreekt) ────────────────
const TWO_GEN = `<table class="table table-pedigree triangle-left">
<tr><td rowspan="2">FATHER</td><td>FS</td></tr>
<tr><td>FD</td></tr>
<tr><td rowspan="2">MOTHER</td><td>MS</td></tr>
<tr><td>MD</td></tr>
</table>`
{
  const { pedigree } = parsePedigree(TWO_GEN)
  check('2-gen: vader/moeder kloppen', pedigree.sire.name === 'FATHER' && pedigree.dam.name === 'MOTHER')
  check('2-gen: grootouders aanwezig', pedigree.sire.sire.name === 'FS' && pedigree.dam.dam.name === 'MD')
  check('2-gen: overgrootouders = null (geen crash)', pedigree.sire.sire.sire === null && pedigree.dam.dam.dam === null)
}

// ── 3) gat in een hele tak: moeders-moeder (MM + kinderen) onbekend ───────────
// Realistische KWPN-rendering: de driehoek blijft RECHTHOEKIG (8 rijen) en
// onbekende voorouders zijn BLANCO cellen (geen weggelaten rijen). Test op
// VERSCHUIVING: een aanwezige voorouder mag NIET in een leeg vak vallen.
const GAP = `<table class="table table-pedigree triangle-left">
<tr><td rowspan="4">FATHER</td><td rowspan="2">FS</td><td>FSS</td></tr>
<tr><td>FSD</td></tr>
<tr><td rowspan="2">FD</td><td>FDS</td></tr>
<tr><td>FDD</td></tr>
<tr><td rowspan="4">MOTHER</td><td rowspan="2">MS</td><td>MSS</td></tr>
<tr><td>MSD</td></tr>
<tr><td rowspan="2"></td><td></td></tr>
<tr><td></td></tr>
</table>`
{
  const { pedigree } = parsePedigree(GAP)
  check('gat: moeder = MOTHER', pedigree.dam.name === 'MOTHER')
  check('gat: moedersvader-tak intact (MS → MSS × MSD)',
    pedigree.dam.sire.name === 'MS' && pedigree.dam.sire.sire === 'MSS' && pedigree.dam.sire.dam === 'MSD')
  check('gat: moedersmoeder = null (niet verschoven)', pedigree.dam.dam === null)
  check('gat: vaderstak volledig intact', pedigree.sire.sire.sire === 'FSS' && pedigree.sire.dam.dam === 'FDD')
}

// ── 4) gat in één blad: één overgrootouder (FSS) onbekend ─────────────────────
const LEAF = `<table class="table table-pedigree triangle-left">
<tr><td rowspan="4">FATHER</td><td rowspan="2">FS</td><td></td></tr>
<tr><td>FSD</td></tr>
<tr><td rowspan="2">FD</td><td>FDS</td></tr>
<tr><td>FDD</td></tr>
<tr><td rowspan="4">MOTHER</td><td rowspan="2">MS</td><td>MSS</td></tr>
<tr><td>MSD</td></tr>
<tr><td rowspan="2">MD</td><td>MDS</td></tr>
<tr><td>MDD</td></tr>
</table>`
{
  const { pedigree } = parsePedigree(LEAF)
  check('blad-gat: FSS = null (niet verschoven)', pedigree.sire.sire.sire === null)
  check('blad-gat: buur FSD intact', pedigree.sire.sire.dam === 'FSD')
  check('blad-gat: rest van de boom intact', pedigree.dam.dam.dam === 'MDD' && pedigree.sire.dam.sire === 'FDS')
}

// ── 5) geen tabel → netjes null, geen crash ───────────────────────────────────
{
  const r = parsePedigree('<div>geen stamboom hier</div>')
  check('geen tabel: pedigree = null', r.pedigree === null && r.pedigree_raw === null)
}

console.log('')
if (failures > 0) { console.error(`❌ ${failures} test(s) gefaald.`); process.exit(1) }
console.log('✅ Alle KWPN pedigree-robuustheidstests geslaagd.')
