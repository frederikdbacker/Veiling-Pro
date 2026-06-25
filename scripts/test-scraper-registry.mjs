// Lichtgewicht regressietest voor de scraper-registry (geen test-runner in dit
// project — een runnable .mjs die met code 1 stopt bij een fout is de conventie).
//
//   node scripts/test-scraper-registry.mjs
//
// Controleert dat elke bekende site naar de juiste scraper mapt, dat de
// arg-afleiding klopt, en dat onbekende/ongeldige URLs netjes afgewezen worden.

import { matchScraper, analyzeUrl } from '../src/lib/scraperRegistry.js'

let failures = 0
function check(name, cond) {
  if (cond) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}`); failures++ }
}

console.log('Positieve gevallen (host → verwachte scraper_key):')
const positive = [
  ['https://bid.aloga-auction.com/auctions/98423791-abc', 'weauction'],
  ['https://woodlandsinternational.weauction.nl/auctions/123', 'weauction'],
  ['https://swbauction.swb.org/auctions/5', 'weauction'],
  ['https://bid.dewoldensummersale.com/auctions/9', 'weauction'],
  ['https://bid.thecollection-auction.com/auctions/34cbecb6-1d90-43aa-ad17-08de9f859131', 'weauction-api'],
  ['https://bid.aloga-auction.com/auctions/x', 'weauction'],
  ['https://www.fences.fr/cheval/vente/selection/', 'fences-catalogus'],
  ['https://horseauctionbelgium.com/collectie/41', 'pwb'],
  ['https://paardenveilingonline.com/collectie/56', 'pwb'],
  ['https://www.zangersheide.com/nl/auctions/zangersheide-stallion-auction-2026', 'zangersheide'],
  ['https://woodlandsinternational.eu/live-auction/8', 'livesauction'],
  ['https://334sporthorsestud.com/live-auction/3', 'livesauction'],
  ['https://schuttertsportsales.com/lot-category/2026/', 'schuttert'],
  ['https://www.starsaleauctions.com/veulens/starsale-veulenoverzicht-2025', 'starsale'],
  ['https://www.jumpingschrodertwente.nl/olympic-dream-auction', 'olympic-dream'],
  ['https://venteexclusive.extrahorses.com/fr/', 'extrahorses'],
  ['https://venteexclusive.extrahorses.com/fr/selection-detail?id=174', 'extrahorses'],
]
for (const [url, key] of positive) {
  const m = matchScraper(url)
  check(`${url} → ${key}`, m.ok && m.scraper.key === key)
}

console.log('\nArg-afleiding:')
check('fences slug', JSON.stringify(analyzeUrl('https://www.fences.fr/cheval/vente/selection/').args) === JSON.stringify(['selection']))
check('zangersheide slug', analyzeUrl('https://www.zangersheide.com/nl/auctions/foo-2026').args[0] === 'foo-2026')
check('schuttert jaar', analyzeUrl('https://schuttertsportsales.com/lot-category/2026/').args[0] === '2026')
check('starsale jaar', analyzeUrl('https://www.starsaleauctions.com/veulens/starsale-veulenoverzicht-2025').args[0] === '2025')
check('pwb volledige url', analyzeUrl('https://horseauctionbelgium.com/collectie/41').args[0] === 'https://horseauctionbelgium.com/collectie/41')
check('olympic-dream geen args', analyzeUrl('https://www.jumpingschrodertwente.nl/olympic-dream-auction').args.length === 0)

const live = analyzeUrl('https://woodlandsinternational.eu/live-auction/8', { houseName: 'Woodlands International Sales' })
check('livesauction base+id+house', JSON.stringify(live.args) === JSON.stringify(['https://woodlandsinternational.eu', '8', 'Woodlands International Sales']))

const wea = analyzeUrl('https://bid.aloga-auction.com/auctions/x', { houseName: 'Aloga' })
check('weauction url+house', JSON.stringify(wea.args) === JSON.stringify(['https://bid.aloga-auction.com/auctions/x', 'Aloga']))

const weaHint = analyzeUrl('https://bid.aloga-auction.com/auctions/x')
check('weauction houseHint = Aloga', weaHint.houseName === 'Aloga' && weaHint.argsOk)

const tcHint = analyzeUrl('https://bid.thecollection-auction.com/auctions/34cbecb6-1d90-43aa-ad17-08de9f859131')
check('weauction-api houseHint = The Collection', tcHint.houseName === 'The Collection' && tcHint.argsOk)
check('weauction-api args = [url, house]', JSON.stringify(tcHint.args) === JSON.stringify(['https://bid.thecollection-auction.com/auctions/34cbecb6-1d90-43aa-ad17-08de9f859131', 'The Collection']))
const tcColl = analyzeUrl('https://bid.thecollection-auction.com/auctions/xyz', { houseName: 'The Collection', collectionName: 'The Collection Live 2026' })
check('weauction-api geeft collectienaam door (geen duplicaat)', JSON.stringify(tcColl.args) === JSON.stringify(['https://bid.thecollection-auction.com/auctions/xyz', 'The Collection', 'The Collection Live 2026']))

console.log('\nHuisnaam-hints:')
check('fences hint', analyzeUrl('https://www.fences.fr/cheval/vente/selection/').houseHint === 'Agence Fences')
check('334 hint', analyzeUrl('https://334sporthorsestud.com/live-auction/3').houseHint === '334 Auction')
check('extrahorses hint', analyzeUrl('https://venteexclusive.extrahorses.com/fr/').houseHint === 'Extra Horses')

console.log('\nNegatieve gevallen:')
check('Hippomundo → no_scraper', matchScraper('https://www.hippomundo.com/en/horse/123').reason === 'no_scraper')
check('Horse Telex → no_scraper', matchScraper('https://www.horsetelex.com/horses/pedigree/123').reason === 'no_scraper')
check('ongeldige URL → invalid_url', matchScraper('dit is geen url').reason === 'invalid_url')
check('lege URL → invalid_url', matchScraper('').reason === 'invalid_url')
check('ftp-protocol → invalid_url', matchScraper('ftp://fences.fr/x').reason === 'invalid_url')
check('fences zonder vente-pad → no_scraper', matchScraper('https://www.fences.fr/about').reason === 'no_scraper')
check('pwb fout pad → no_scraper', matchScraper('https://horseauctionbelgium.com/over-ons').reason === 'no_scraper')
check('schuttert zonder jaar → argsOk false', analyzeUrl('https://schuttertsportsales.com/lot-category/').argsOk === false)

console.log('')
if (failures > 0) {
  console.error(`❌ ${failures} test(s) gefaald.`)
  process.exit(1)
}
console.log('✅ Alle registry-tests geslaagd.')
