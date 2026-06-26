# "Collectie ophalen" maakt geen dubbele collectie meer (dedupe op de link)

**Datum:** 26 juni 2026
**Thema:** Een veiling herkennen aan zijn link i.p.v. zijn naam, zodat een
her-ophaling geen tweede collectie meer aanmaakt.
**Branch:** `feat/collectie-dedupe-op-link`
**Schemawijziging:** ja — additieve, idempotente migratie `0037` (toegepast).

## In gewone taal — wat was het probleem?

Het systeem herkende een veiling aan **huis + naam**. Toen een her-ophaling van
"The Collection" een iets andere naam teruggaf ("The Collection 2026" i.p.v.
"…Live 2026"), dacht het systeem: nieuwe veiling → het maakte een **tweede
collectie**. De **link** naar de veiling was identiek, maar telde niet mee.

## Wat is er nu anders

Een veiling wordt voortaan herkend aan zijn **link** (die is stabiel; de naam
niet). Bij "Collectie ophalen" voor een veiling die al in het systeem staat:
**geen tweede collectie**, maar de melding *"Deze veiling stond al in het
systeem"* + de gebruiker landt op de **bestaande** collectie. (Productkeuze van
Frederik: melden + naar de bestaande, niet stilzwijgend overschrijven.)

## Hoe het in elkaar zit (drie lagen)

1. **Eén gedeelde "schoonmaak"-functie** `normalizeSourceUrl()` in
   `src/lib/scraperRegistry.js` (gebruikt door zowel de app als de worker):
   trim → alles vanaf de eerste `?`/`#` weg → trailing slash weg → kleine
   letters. Dezelfde veiling levert zo altijd exact dezelfde sleutel, ongeacht
   pagina-parameters of hoofdletters.
2. **De worker kijkt vóór het scrapen** (`bin/scrape-worker.mjs`, `processJob`,
   alleen `mode=create`) of er al een collectie met diezelfde genormaliseerde
   link bestaat. Zo ja: niet scrapen, geen tweede collectie, job afsluiten met
   een vriendelijke melding + het bestaande `collection_id` (de app linkt daar
   al naartoe). De UI (`ScrapeJobStatus.jsx`) toont bij `progress.already` een
   eigen tekst i.p.v. "lots geladen".
3. **Een slot in de database** (migratie `0037`): een **gegenereerde** kolom
   `collections.source_url_norm` (de database rekent de genormaliseerde link
   zelf uit source_url) + een **partiële unieke index** erop. Zo kunnen er
   technisch nooit twee collecties met dezelfde link bestaan — ook bij een
   handmatige import buiten de worker om. Om het slot al **bij het aanmaken** te
   laten bijten, schrijft `scripts/import-lots.mjs` de link nu mee op de
   collectie (optionele `--source-url`-vlag die de worker meegeeft); zonder die
   vlag verandert er niets aan handmatige imports.

**Waarom een gegenereerde kolom?** Dan blijven de match in de app (laag 2) en
het slot in de database (laag 3) gegarandeerd identiek — niemand hoeft de
genormaliseerde waarde handmatig bij te houden, en ze kunnen niet uit elkaar
lopen. Dat laatste is de spil: liepen ze uiteen, dan zou de worker een bestaande
veiling missen en zou de import op het slot crashen i.p.v. netjes "staat er al"
te melden.

## Eerlijke dekking

De link-dedupe geldt voor de "Collectie ophalen"-flow (importer
`import-lots.mjs`). De andere importers (Fences-kalender, Hannoveraner,
Fences-ventes) hebben géén link en doen niet mee — terecht, want zij horen niet
bij deze flow. Hun collecties houden `source_url_norm = NULL` en worden door het
partiële slot genegeerd.

## Getest (acceptatie — alles groen)

1. **Pariteit JS ↔ DB (de spil).** Vijf varianten van een veiling-link (kaal,
   met `?auctionPage=…`, met trailing slash, met hoofdletters in het domein, met
   `#fragment`) in de DB geschreven, `source_url_norm` teruggelezen en vergeleken
   met `normalizeSourceUrl()` in JS → **alle vijf exact gelijk**. (Wegwerprijen
   via een transactie met rollback; niets bleef achter.)
2. **Laag 1 end-to-end.** Een bestaande The Collection-link (mét
   `?auctionPage=…`) opnieuw "ophalen" → binnen ~0,4s "veiling bestaat al: The
   Collection Live 2026", **geen scrape**, job `done` met het bestaande
   `collection_id` en `progress.already=true`; aantal collecties met die link
   bleef **1** (geen duplicaat), totaal 323 ongewijzigd.
3. **Slot + nette fout.** Een collectie met afwijkende naam maar dezelfde
   genormaliseerde link invoegen → faalt op `collections_source_url_norm_key`;
   `humanize()` vertaalt dat naar *"Deze veiling staat al in het systeem onder
   een andere naam…"* — duidelijke melding, geen stille hang.
4. **Niet-geraakt.** De 322 link-loze collecties → `source_url_norm` NULL, geen
   index-hinder.
5. **Migratie**: 0 botsende links vóór toepassen (geverifieerd); kolom + index
   bestaan. `npm run build` groen.

## Geraakte bestanden

- `src/lib/scraperRegistry.js` — `normalizeSourceUrl()` (nieuw, geëxporteerd).
- `bin/scrape-worker.mjs` — pre-check (laag 1), `finishJob` `alreadyExisted`,
  `humanize()`-patroon voor de unieke-schending, `--source-url` aan de importer.
- `scripts/import-lots.mjs` — optionele `--source-url`-vlag → link bij creatie.
- `supabase/migrations/0037_collections_source_url_norm.sql` — gegenereerde
  kolom + partiële unieke index.
- `src/components/ScrapeJobStatus.jsx` — "bestond al"-melding (volledig + compact).

## Restpunten

- Normalisatie str/ipt **alle** query-parameters. Voor de huidige sites zit de
  veiling-identiteit in het pad (UUID/slug), dus dat is juist. Mocht een site
  ooit de id in een parameter zetten, dan voegen we per site een whitelist toe —
  **in zowel de JS-helper als de migratie-expressie** (ze moeten gelijk blijven).
- Geen migratie van de 322 bestaande link-loze collecties; die blijven bewust
  `NULL` (handmatig/anders aangemaakt).
