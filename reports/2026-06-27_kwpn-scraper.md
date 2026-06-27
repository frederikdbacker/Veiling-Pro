# Audit — KWPN-scraper (kwpn.auction)

**Datum:** 27 juni 2026
**Branch:** `feat/kwpn-scraper` (nog niet gepusht — commit/push enkel op vraag)
**Schemawijziging:** geen → geen migratie

## Wat & waarom

KWPN verkoopt via **kwpn.auction** (Pweb/Media-Primair-familie, verwant aan 334 /
Woodlands). De opdracht ging uit van een *drop-in* op de bestaande
`scrape-livesauction.mjs`. **Live-verificatie weerlegde dat:** alleen
"server-side gerenderd + lot-links op de collectiepagina" is gedeeld; de
veld-parsing, de afstamming, het lot-detailpad én de discipline wijken wezenlijk
af. Daarom — en conform de projectregel "bewezen scraper niet wijzigen" + het
verse HORSE24-precedent — is een **eigen scraper** gebouwd; `scrape-livesauction.mjs`
is byte-voor-byte ongemoeid gebleven (geen regressierisico voor 334/Woodlands).

### Verschillen met livesauction (live geverifieerd)
| Aspect | 334 / Woodlands | KWPN |
|---|---|---|
| collectiepad | `/live-auction/<id>` | `/live-veiling/<id>` (NL) |
| lot-detailpad | `/auction/<slug>` | `/veiling/<slug>` |
| velden | `<th><b>LABEL</b></th><td>…` | `<td><i…></i> LABEL:</td><td>…` |
| afstamming | uit de slug (sire-x-…) | rowspan-driehoektabel |
| moeder | — | de **slug geeft de moedersvader**, niet de moeder |
| discipline | hardcoded "Springen" | afgeleid per lot (dressuur/springen) |

## Wijzigingen

**Nieuw**
- `scripts/lib/kwpn.mjs` — kernparsing + collectie-orkestratie (`scrapeCollection`).
  KWPN-veld-parsing, lotnummer+schone naam uit de H1, **rowspan-aware
  pedigree-driehoek** → het bestaande `lots.pedigree`-formaat (mét de échte
  moeder), foto's via fancybox-`href`, HorseTelex-link, discipline per lot,
  echte browser-UA.
- `scripts/scrape-kwpn.mjs` — dunne CLI-wrapper (model = `scrape-horse24.mjs`):
  harde 0-lots-check, schrijft `data/kwpn-<slug>.json` in het import-lots-formaat.
- `scripts/test-kwpn-pedigree.mjs` — offline robuustheidstest voor de
  pedigree-parser (volledig, 2-gen, tak-gat, blad-gat, blanco cellen, geen tabel).

**Gewijzigd (alleen toevoegingen)**
- `src/lib/scraperRegistry.js` — pure helper `kwpnAuctionParts` + nieuwe
  `kwpn`-entry (match host `kwpn.auction`, `houseHint → 'KWPN'`, `needsHouseName`,
  `collectionName`-doorgifte voor dedupe-op-link). Livesauction-entry +
  `liveAuctionParts` onaangeroerd.
- `scripts/test-scrapers-live.mjs` — KWPN-canary (`kwpn.auction/live-veiling/303`)
  met het "check eerst of de pagina nog bestaat"-commentaar.
- `scripts/test-scraper-registry.mjs` — KWPN routing/arg-cases. **+ één
  pre-existing stale regel gecorrigeerd**: de positieve case voor The Collection
  verwachtte nog de oude key `weauction-api`, terwijl de registry sinds de
  weauction-unificatie (26-06) naar de ene `weauction`-entry routeert. Dit was
  een verouderde *testverwachting* (er bestaat geen `weauction-api`-key meer);
  enkel de verwachting is bijgewerkt, de bewezen weauction-scraper is niet
  geraakt. `npm run test:registry` was hierdoor al rood op `main` vóór deze
  sessie en is nu weer groen.

## Verificatie (alles groen)
- `npm run test:registry` → ✅ (incl. nieuwe KWPN-cases + stale weauction-regel gefixt).
- `node scripts/test-kwpn-pedigree.mjs` → ✅ 16/16 (geen crash, geen verschuiving bij gaten).
- `node scripts/test-scrapers-live.mjs` → **13 groen · 0 rood · 0 overgeslagen**,
  waaronder **kwpn 26 lots** en **livesauction/334 30 lots** (334 onaangeroerd bewezen).
- `npm run build` → ✅ (chunk-grootte-waarschuwing is pre-existing, geen error).
- `git diff` → `scripts/scrape-livesauction.mjs` = 0 wijzigingen.

## Steekproef (3 lots, mét échte moeder)
| # | Naam | Vader | Moeder (echt) | de slug zou geven (= moedersvader, fout) |
|---|---|---|---|---|
| 399 | TONY GOLD | GLOCK'S TOTO JR. | **AWEIH** | apache |
| 420 | TI SENTO | KJENTO | **FIENI** | krack-c |
| 352 | TRINELLOWAARD | EXTREME U.S. | **IRISH WAARD** | florencio |

Plus per lot: jaar (2023), geslacht, stamboek, stokmaat (cm), foto, HorseTelex-link,
KWPN-predikaten ("SELECTED & PREMIUM" …) bewaard in de notitie, en de volledige
3-generatie-stamboom.

## Onvolledige stamboom
De robuustheid bij gaten is expliciet gevraagd. **Alle in-scope live
KWPN-collecties (Select Sale dressuur/springen, via `/live-veiling` + `/veiling`)
hebben een vólledige 3-generatie-stamboom** — er is op dit moment geen live
onvolledig-stamboom-lot beschikbaar (de veulen-/embryo-/broodmare-collecties
staan op `/collectie/<id>` en publiceren nog geen `/veiling`-lots). De robuustheid
is daarom hard bewezen met `scripts/test-kwpn-pedigree.mjs`, die de parser voedt
met onvolledige driehoeken (ontbrekende generaties, een hele tak weg, losse blanco
cellen) en aantoont dat hij een **partiële boom** teruggeeft: ontbrekende
voorouders worden `null`, een aanwezige voorouder verschuift nooit in een leeg vak.

## Wat kan er misgaan / aandachtspunten
- KWPN kan zijn markup wijzigen → de live-canary vangt dat (rood = stille breuk).
- Catalogtekst is best-effort (eerste zinvolle `<p>`, boilerplate uitgesloten).
- De KWPN-database-link (`kwpn.nl/database?Paard=…`) heeft geen import-slot →
  enkel HorseTelex wordt geïmporteerd; de db-link staat wel in de JSON.

## Rollback
`git checkout main` (branch nog niet gemerged) — niets in productie geraakt.

## Restpunt (geen blocker)
De kleine helpers (`decodeEntities`/`clean`/`genderToNL`/…) staan nu in meerdere
scrapers gekopieerd. Ooit samenbrengen in één `scripts/lib/scrape-helpers.mjs` —
bewust nu niet (zou bewezen scrapers raken).
