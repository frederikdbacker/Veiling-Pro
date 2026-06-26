# weauction-routing frontend-onafhankelijk + live regressietest

**Datum:** 26 juni 2026
**Thema:** Kies de weauction-scraper op capaciteit (heeft de tenant een JSON-API?)
i.p.v. op hostnaam, plus een live regressietest tegen stille 0-lots.
**Branch:** `feat/weauction-routing-capaciteit`
**Schemawijziging:** geen.

## In gewone taal — wat was het risico?

weauction draait meerdere veilinghuizen (Aloga, WEF, De Wolden, The Collection…).
De registry koos de scraper op **hostnaam**: The Collection → de nieuwe
JSON-API-scraper, de rest → de oude DOM-scraper (Puppeteer leest de pagina).
Migreert weauction een bestaand huis naar de nieuwe Tailwind-frontend, dan blijft
die host naar de **oude** DOM-scraper wijzen → die vindt niets meer → **stil 0
lots**, zonder foutmelding. De keuze moest op **capaciteit**, niet op host.

## Verificatie-eerst (bepaalde het ontwerp)

Getest of de JSON-API ook bij de oude tenants werkt:
`GET <origin>/api/auctions/<id>/Items/published?Page=1&PageSize=N`

| Tenant | HTTP | lots |
|--------|------|------|
| The Collection | 200 | 21 |
| Aloga 2025 | 200 | 24 |
| WEF 2025 | 200 | 14 |
| De Wolden 2025 | 200 | 21 |

➡️ **Álle weauction-tenants leveren de JSON-API.** De DOM-scraper is daardoor nog
enkel **vangnet** (oude frontend zonder API). Bonus: `scrape-weauction-api.mjs`
doet zélf al de Hippomundo-stamboomstap, dus de API-route is voor Aloga/WEF zelfs
**rijker** dan de oude DOM-route.

## Wat is er gebouwd (additief — bestaande scrapers onaangeroerd)

1. **Dispatcher `scripts/scrape-weauction-dispatch.mjs`** — kiest op capaciteit:
   haalt `origin` + `auctionId` uit de URL, doet één lichte API-probe, en draait
   dan de juiste bestaande scraper via een **dynamische import in hetzelfde
   proces** (beide scrapers lezen `process.argv[2..4]` = `url house [collection]`,
   dus ze blijven byte-voor-byte ongewijzigd; geen subprocess, geen
   Puppeteer-orphans, geen logica-duplicatie).
   - **Probe-semantiek (bewust):** API geeft data → API-route; API **404 of
     200-met-0-lots** → DOM-vangnet (echte afwezigheid); **timeout/DNS/5xx** →
     transient → **één retry**, en anders een **luide fout** (exit ≠ 0). Een
     netwerk-blip valt dus NOOIT stilletjes terug op de trage DOM-route met
     alsnog 0 lots — precies de stille breuk die we uitsluiten.
2. **Registry → één `weauction`-entry** (`src/lib/scraperRegistry.js`) die alle
   bekende weauction-hosts matcht en naar de dispatcher wijst. `houseHint` voor
   álle huizen behouden, `needsHouseName` + **`collectionName`-doorgifte**
   behouden (cruciaal voor "Catalogus ophalen" in een bestaande collectie → geen
   duplicaat; breekt de dedupe-op-link niet). De `match` blijft bewust een
   host-**allowlist** (als code-commentaar vastgelegd): een gloednieuwe tenant
   met een andere host moet nog steeds expliciet worden toegevoegd — geen blinde
   "ziet eruit als weauction"-match.
3. **Live regressietest `scripts/test-scrapers-live.mjs`** — fixtures per
   registry-key → recente auction-URL. Controleert per fixture dat de registry
   correct routeert én dat er lots zijn. Voor weauction gebeurt de lot-telling
   **goedkoop via de API-listing** (PageSize hoog, tel de data-array), NIET via
   de per-lot Hippomundo-verrijking — anders duurt het minuten. Een diepere,
   volledige weauction-scrape zit achter de vlag **`--deep`**. Print een
   ✅/❌/⏭-tabel en exit ≠ 0 bij één 0-lots/fout (skips tellen niet). Nieuw
   weggeschreven `data/*.json` wordt opgeruimd (pre-existing bestanden ongemoeid).

## Getest (acceptatie — groen)

- **Regressietest:** 8 groen · 1 rood · 2 overgeslagen (exit 1 — terecht, zie
  zangersheide). Fixtures uitgebreid van 4 naar 9 actief (recente veiling per
  platform uit de DB):
  - weauction · The Collection → ✅ 21 · Aloga → ✅ 24 · WEF → ✅ 14 (via API)
  - extrahorses → ✅ 21 · schuttert → ✅ 15 · starsale → ✅ 48 ·
    olympic-dream → ✅ 16 · fences-catalogus → ✅ 26 (echte scrapes)
  - **zangersheide → ❌ (echte vondst):** zangersheide.com staat nu achter
    **Cloudflare** — een kale fetch geeft 403 (ook de homepage). De fetch-scraper
    `scrape-zangersheide.mjs` is daardoor stuk en moet naar een echte-browser-
    aanpak (Puppeteer, zoals bij Hippomundo). Bewust NIET geskipt: de site is niet
    offline, dit rood is een terechte stille-breuk-melding. **Aparte fix-taak.**
  - pwb · livesauction → ⏭ overgeslagen (geen bruikbare entry-URL in de DB:
    geen PWB-`/collectie/<id>` resp. geen livesauction-`/live-auction/<id>`).
  - De test laat **geen** `data/*.json` gewijzigd achter: een overschreven
    bestaand bestand wordt hersteld, een nieuw bestand gewist.
- **Dispatcher end-to-end:** geldige auction → "JSON-API — 21 lots"; onbestaande
  auction-id → "DOM-vangnet — API leeg (0 lots)". Routekeuze correct.
- **Routing-assertie:** alle 5 weauction-hosts → één `weauction`-entry → de
  dispatcher, met de juiste huisnaam.
- `npm run build` groen.

## Hoe draai ik de regressietest (op de Mac mini)

```
node scripts/test-scrapers-live.mjs          # snel — weauction via de API-listing
node scripts/test-scrapers-live.mjs --deep   # ook de volledige weauction-scrape (incl. Hippomundo)
```

## Restpunten / aandachtspunten

- De `match` is een host-allowlist: nieuwe weauction-tenants met een andere host
  toevoegen aan `match` + `houseHint`. Bewuste keuze (vermijdt valse matches),
  als commentaar bij de entry vastgelegd.
- De fixtures voor de niet-weauction scrapers staan op `skip` (geen actuele
  veiling-URL); activeer ze door een huidige URL in te vullen. Een oude/afgelopen
  URL geeft 0 lots → rood (terecht).
- De live worker draait pas op de nieuwe routing **na een herstart**
  (`launchctl kickstart -k`); te doen na de merge naar `main`.
