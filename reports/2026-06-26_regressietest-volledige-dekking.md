# Regressietest dekt nu alle 11 scrapers (pwb + livesauction gedicht)

**Datum:** 26 juni 2026
**Thema:** De laatste twee blinde vlekken in de live regressietest dichten.
**Branch:** `test/pwb-livesauction-fixtures`
**Schemawijziging:** geen. (Test-fixtures only.)

## In gewone taal

`scripts/test-scrapers-live.mjs` testte 9 van de 11 scrapers; **pwb** en
**livesauction** werden overgeslagen omdat er geen instap-URL bekend was. Daar zou
een stille breuk onopgemerkt kunnen blijven. Nu draaien ze mee.

## Verificatie-eerst (live op de mini, met de scraper-UA)

| Platform | Kandidaat-URL | Resultaat |
|---|---|---|
| pwb | `horseauctionbelgium.com/collectie/41` | ✅ 200 · 28 kaarten |
| pwb | `paardenveilingonline.com/collectie/56` | ✅ 200 · 60 kaarten (alternatief) |
| livesauction | `334sporthorsestud.com/live-auction/3` | ✅ 200 · 30 lot-links |
| livesauction | `woodlandsinternational.eu/live-auction/8` | ❌ 500 (verlopen) |

Beide platforms hebben een werkende **live-canary** → de offline-snapshot-vangnet
was niet nodig.

## Wijziging (één bestand, alleen fixtures)

In `scripts/test-scrapers-live.mjs` de twee `skip`-entries vervangen door actieve
`mode: 'scrape'`-fixtures:
- **pwb** → `https://horseauctionbelgium.com/collectie/41` (één fetch, alle lots
  op de collectiepagina). Alternatief in commentaar: `paardenveilingonline.com/collectie/56`.
- **livesauction** → `https://334sporthorsestud.com/live-auction/3` (collectie +
  ≈30 lot-detailpagina's). Woodlands `/live-auction/8` gaf 500; in commentaar
  genoteerd om te vervangen als deze ooit rood wordt.

Geen wijziging aan de scrapers, de registry of de test-mechaniek.

## Getest (acceptatie — groen)

- `node scripts/test-scrapers-live.mjs` → **11 groen · 0 rood · 0 overgeslagen**
  (pwb 28, livesauction 30; de andere 9 ongewijzigd). Exit 0.
- De test laat de working tree schoon (geen getrackte `data/*.json` gewijzigd).
- `npm run build` groen.

## Restpunt

- De fixtures wijzen naar concrete collecties (pwb-collectie 41,
  334-live-auction 3). Worden die ooit offline gehaald, dan kleurt die fixture
  rood → vervang de URL door een actuele collectie van hetzelfde platform (de
  alternatieven staan als commentaar in de fixture-lijst).
