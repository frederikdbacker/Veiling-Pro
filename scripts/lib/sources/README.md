# Bron-adapters voor collectie-import

Wanneer een collectie via een link wordt gevoed, herkent het systeem de
feitelijke pagina en roept het het juiste scraper-script aan. Elke
veilingsite-platform is één adapter in deze map.

## Hoe het werkt

```
URL ─▶ resolveSource(url)
        1. resolveByHost(url)   — match op hostnaam (geen netwerk)
        2. resolveBySniff(html) — 1 fetch + herken op pagina-inhoud
                                   (voor onbekende white-label domeinen)
   ─▶ adapter.scrape(url, { enrich, onProgress }) ─▶ { meta, horses }
   ─▶ import-collection.mjs schrijft naar collections + lots
```

`resolveSource` zit in `index.mjs`. `import-collection.mjs` gebruikt het;
zowel de CLI (`scripts/import-from-url.mjs`) als het Vite dev-endpoint
(`POST /api/import-collection`) lopen via dezelfde weg.

## Adapter-contract

```js
export default {
  id:        'horse24',                  // uniek kebab-id (→ meta.source)
  label:     'HORSE24',                  // leesbaar
  hostnames: ['horse24.com', ...],       // bekende domeinen
  match(url)        -> boolean,          // host-herkenning
  sniff(html)       -> boolean,          // inhoud-herkenning (fallback)
  scrape(url, opts) -> { meta, horses }, // de scraper
}
```

`scrape` levert:

- `meta`: `{ auction, website, source_url, date, description, total, source }`
- `horses[]`: `{ lot_number, name, slug, discipline, year, gender, size,
  studbook, sire, dam, pedigree, pedigree_raw, catalog_text, photos[],
  video_url, source_url, starting_bid, url_horsetelex, url_extra }`
  - `pedigree` = geneste 3-generatie-boom in DB-formaat:
    `{ sire:{name,sire:{name,sire,dam},dam:{…}}, dam:{…} }`

Een nieuwe adapter toevoegen: maak `scripts/lib/sources/<id>.mjs` volgens het
contract en registreer hem in de `SOURCES`-array in `index.mjs`.

## Platforms

| Platform | id | Domeinen | Status | Datavorm |
|---|---|---|---|---|
| HORSE24 (white-label) | `horse24` | horse24.com, verdener-auktion-online.com, `*.horse24.com` | ✅ werkend | Server-rendered Vue: `:auction='{}'` + `:lots='[]'` op de overzichtspagina (hele collectie in 1 request); `:lot='{}'` + `<pedigree-view :pedigrees='{}'>` op de detailpagina. |
| WeAuction (o.a. Aloga) | `weauction` | aloga-auction.com, weauction.com, clipmyhorse.tv | ✅ werkend | Angular-SPA + JSON-API: `/api/auctions/{uuid}` + `/api/auctions/{uuid}/items/published?page=1&pageSize=N` (hele collectie, alle velden, geen detailcall). |
| PWB (Horse Auction Belgium / Paardenveilingonline) | `pwb` | horseauctionbelgium.com, paardenveilingonline.com | ✅ werkend | Server-rendered Bootstrap-HTML: hele collectie als `.card-collection`-kaarten op `/collectie/{id}`. **Geen** per-paard detailpagina. |
| Zangersheide | `zangersheide` | zangersheide.com | ✅ werkend | Server-rendered HTML: overzicht `/{lang}/auctions/{slug}` linkt naar detailpagina's `/{lang}/auctions/{slug}/{horse}` met `<div id="pedigree">`. |

## Afstamming (PDGR) — verschilt per platform

Belangrijk: elk platform toont de afstamming anders. Wat de adapter eruit haalt:

| Platform | Bron van de afstamming | Diepte | Naar `lots.pedigree` |
|---|---|---|---|
| HORSE24 | `<pedigree-view :pedigrees='{V,M,VV,VM,VVV,…}'>` (posities) | **3+ generaties**, volledig gestructureerd | volledige 3-gen geneste boom |
| Zangersheide | `<div id="pedigree">` — platte namenreeks: eerst 15 namen vader-tak (breadth-first), dan 15 moeder-tak | **3+ generaties** | 3-gen geneste boom via BFS-split (`bfsBranchToNode`) |
| WeAuction/Aloga | veld `subtitle` = `"Vader x Moedervader"`; `pedigreeGenerations[]` (meestal leeg); soms PDF (`pedigreeFilePath`) | **1 generatie** (tenzij de veiling `pedigreeGenerations` vult) | `{sire:{name},dam:{name}}` |
| PWB | kaart-`<p class="horsepedigree">` = `"Vader x Moedervader"`; de scheidings-`x` is **getagd** (`<small><b>x</b></small>` óf `<span class="text-secondary">x</span>`) en verschilt per white-label — splits op het getagde element, niet op een kale `x` (anders breekt "Nixon") | **1 generatie** | `{sire:{name},dam:{name}}` |

Conventie: `lots.pedigree` = `{ sire:{name,sire,dam}, dam:{name,sire,dam} }`
(gen1/gen2 = object, gen3 = naam-string). Adapters die maar 1 generatie
hebben, vullen enkel `sire.name`/`dam.name`. `pedigree_raw` is altijd een
leesbare tekstfallback.

### Bekende beperkingen / nuances

- **Zangersheide**: foto's worden client-side geladen → niet uit de
  statische HTML te halen (`photos` blijft vaak leeg); naam, afstamming,
  geslacht en geboortejaar wél. De moeder-tak-wortel is soms de moedervader
  i.p.v. de merrie zelf (afhankelijk van wat Zangersheide rendert) — de
  3-gen-structuur klopt, de exacte M-naam per veiling verifiëren.
- **WeAuction**: charity/non-paard-loten hebben in `subtitle` een slogan
  i.p.v. een afstamming (edge-case).
- **PWB**: embryo-loten hebben de afstamming ook in de naam
  (`FROZEN EMBRYO | X x Y`); geen geboortejaar/geslacht.
- **PWB**: lotnummer en datum staan niet altijd op de kaart → eventueel
  per-veiling meegeven via de import-parameters.

### HORSE24 — specificatie

- Overzichtspagina-attribuut `:auction='…'` → veilingnaam, slug,
  `system_auction_id`, `start`/`live_start` (datum), `translated_short_description`.
- `:lots='[…]'` → alle lots met `number`, `translated_title`, `translated_slug`,
  `date_of_birth`, `gender.title.nl`, `shire`, `dam_by`, `opening_price`,
  `lot_image`.
- Detailpagina `<base>/lots/<slug>-<id>`: `:lot='…'`
  (`additional_information[].de` = catalogustekst, `main_video`,
  `lot_breed`, `translated_horsetelex_link`, `pedigree_link`) en
  `<pedigree-view :pedigrees='{V,M,VV,VM,VVV,…}'>` (posities: V=vader,
  M=moeder, elke extra letter = volgende generatie).
- Alle lots zijn veulens bij YoungSTARS → `lot_type` `foal`.

## Per-veiling context

Elke veiling op een platform heeft dezelfde weergave, dus de adapter werkt
collectiebreed. Veiling-specifieke afwijkingen (bv. een vaste `lot_type`, of
een afwijkende naam in onze app) worden meegegeven aan de import en
vastgelegd op de `collections`-rij:

- `collections.notes` bevat `bron: <source_url>` — hieruit kan de
  "↻ Collectie verversen via URL"-knop de juiste adapter opnieuw kiezen.
- Import-parameters (`name`, `house`, `location`, `date`, `status`,
  `lotTypeKey`, `updateExisting`) leggen de per-veiling context vast en
  kunnen per veiling verschillen zonder codewijziging.
