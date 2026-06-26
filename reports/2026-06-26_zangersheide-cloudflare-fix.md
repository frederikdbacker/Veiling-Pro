# Zangersheide-scraper gerepareerd (Cloudflare → Puppeteer)

**Datum:** 26 juni 2026
**Thema:** `scrape-zangersheide.mjs` faalde doordat zangersheide.com achter
Cloudflare ging; transport-laag vervangen door een echte browser.
**Branch:** `fix/zangersheide-cloudflare-puppeteer`
**Schemawijziging:** geen.

## In gewone taal — wat was er kapot?

De live regressietest van gisteren vond een **stille breuk**:
`scrape-zangersheide.mjs` haalde de pagina's op met een gewone (kale) download.
Zangersheide zette zijn site achter **Cloudflare** (een beveiligingslaag), die
zo'n kale download blokkeert met **403 Forbidden** — óók de homepage. Gevolg: de
scraper kreeg niets binnen en zou in productie stil **0 lots** geven. De site is
niet offline; alleen de manier van ophalen was stuk.

## Verificatie-eerst (bepaalde het ontwerp)

- Kale download van een auction-pagina → **403** (bevestigd).
- Een **echte browser** (Puppeteer) passeert Cloudflare en rendert de pagina mét
  lots.
- **Belangrijke ontdekking:** een twééde navigatie in dezelfde browsersessie
  wordt door Cloudflare **hard geblokkeerd** ("Attention Required"). Een **verse
  incognito-context per pagina** komt er wél langs — en is veel lichter dan een
  volledige browser-herstart per lot (telt bij foals-veilingen van 50-100 lots).
- De collectiepagina alléén is niet genoeg: geboortejaar, geslacht, stokmaat,
  lotnummer en catalogustekst staan enkel op de detailpagina's → die zijn nodig,
  maar via de lichte context-aanpak goedkoop.

## Wat is gewijzigd (alleen transport, parsing ongemoeid)

In `scripts/scrape-zangersheide.mjs` is enkel de ophaal-functie `fetchHtml`
vervangen:
- **Eén gedeeld browserproces**, met **per pagina een verse incognito-context**
  (`browser.createBrowserContext()`); browser-UA, viewport 1280×1400, ruime
  timeouts (60s navigatie + tot 25s pollen tot de echte inhoud er staat).
- **Cloudflare-blok onderscheiden van een échte 0:** detecteert de
  "Attention Required"-pagina en doet dan een **retry** met een verse context, en
  als laatste redmiddel één **volledige relaunch** (bewezen aanpak) — nooit stil
  als leeg behandelen. Kleine pauze tussen lots tegen rate-limiting.
- **Harde fail bij 0 lots** (geen lege import).
- Alle parsing-logica is ongewijzigd (werkt op de HTML-string, nu de gerenderde).

Dit hergebruikt het bestaande Cloudflare-via-Puppeteer-patroon uit
`scrape-weauction-api.mjs` (Hippomundo-stamboom).

## Getest (acceptatie — groen)

- `node scripts/scrape-zangersheide.mjs zangersheide-stallion-auction-2026` →
  **18 lots**, compleet (naam, lotnummer, vader, jaar, geslacht, stokmaat,
  stamboek, discipline, richtprijs, 5 foto's + video, catalogustekst).
- `node scripts/test-scrapers-live.mjs` → **9 groen · 0 rood · 2 overgeslagen**
  (zangersheide nu ✅ 18; pwb + livesauction nog skip).
- `npm run build` groen.

## Beperking (akkoord)

Zangersheide-foto's laden client-side; in de praktijk komen de portretfoto's wel
mee (5 per lot gezien). Geen blocker voor de lots zelf.

## Restpunt

- pwb + livesauction blijven in de regressietest op skip (geen bruikbare
  entry-URL in de DB) — later te dichten met een offline-snapshot-fixture.
