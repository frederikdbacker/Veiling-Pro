# Plan — Collectie ophalen door een link te plakken (URL-ingest)

**Status:** ontwerp / planning — *nog geen implementatie*
**Datum:** 23 juni 2026
**Auteur:** Claude Code (in opdracht van Frederik)
**Scope:** UI + datamodel + job-uitvoering om binnen een veilinghuis een
collectie-URL te plakken, de juiste (vaak veiling-specifieke) scraper te kiezen
en te starten, en de binnengehaalde lots in de site te krijgen — met
status-/voortgangsfeedback, foutafhandeling en deduplicatie.

> Leeswijzer: dit document volgt de gevraagde opbouw — (A) doel, (B) huidige
> situatie zoals die *echt* in de repo werkt (met bestandsverwijzingen),
> (C) voorgestelde architectuur en de kernbeslissing "wáár draait de scrape",
> (D) datamodel/migraties, (E) API/contract, (F) frontend, (G)
> scraper-registry/selectie, (H) jobs/queue/worker, (I) gefaseerd
> implementatieplan met concrete to-do's per bestand, (J) teststrategie,
> (K) open vragen/risico's. Aannames zijn als **[AANNAME]** gemarkeerd.

---

## A. Doel

Een veilinghuis heeft (nog) geen geplande veiling in Veiling Pro, maar zet op
een bepaalde datum een **collectie online** op zijn eigen site. Frederik wil
dan op de Veiling Pro-website:

1. binnen de context van dat veilinghuis een **collectie-link plakken**;
2. een **proces starten** dat automatisch de **juiste scraper** kiest voor die
   site/dat huis en de collectie binnenhaalt;
3. **live zien** of het lukt (in de wachtrij / bezig / klaar / mislukt), met een
   begrijpelijke melding bij fouten;
4. de lots achteraf gewoon in de bestaande collectie-/cockpit-flow gebruiken —
   inclusief de geplande **dag-opsplitsing** uit
   `docs/plan-meerdaagse-collectie-opsplitsing.md`.

Vandaag bestaat hier **geen enkele UI voor**: scrapen is een handmatige
terminal-handeling die alleen Frederik (of Claude Code) op een Mac kan doen.

---

## B. Huidige situatie — zoals het écht werkt

### B.1 Stack en — cruciaal — het ontbreken van een backend

- **Frontend:** React (Vite) SPA, statisch gehost op Vercel
  (`vercel.json` bevat enkel een SPA-fallback rewrite, geen functies).
- **Database/API:** Supabase (`src/lib/supabase.js`) met de **publishable/anon
  key in de client**. **RLS is permissive** (`using (true) with check (true)`),
  dus de frontend kan **rechtstreeks rijen lezen/schrijven** zonder login.
- **Geen serverside code.** Er is **geen `api/`-map** (Vercel serverless
  functions), **geen `supabase/functions/`** (Edge Functions). `supabase/` bevat
  enkel `migrations/`. **Bevestigd** door de repo-scan.
- **Scrapers zijn losse Node-CLI-scripts** in `scripts/`, die Frederik (of
  Claude Code) **handmatig op een Mac draait**:
  ```bash
  node --env-file=.env.local scripts/import-lots.mjs data/<file>.json
  ```
- **`package.json` heeft géén scrape-npm-scripts** (alleen `dev`/`build`/
  `preview`). **`puppeteer@^24` staat wél als dependency** — de weauction-familie
  vereist een echte headless Chrome.

> **Gevolg (de kernbeperking van dit hele plan):** een statische SPA kan zélf
> geen scraper draaien. Lange scrapes (Puppeteer-Chrome, tientallen detail-
> pagina's met sleeps) passen ook **niet** in een request/response serverless-
> functie. Er moet dus een **plek komen waar de scrape-job draait**. Dit is de
> centrale architectuurkeuze — zie C.

### B.2 Datamodel (live schema, na migratie 0018 rename)

```
auction_houses (1) ──< collections (N) ──< lots (N)
```

- **`auction_houses`** — `id, name (unique), country, website, contact, notes`.
- **`collections`** (heette `auctions`, hernoemd in `0018`) — één online
  collectie / verkoop. Relevante kolommen:
  `id, house_id, name, date, location, status (default 'planned'), notes,
  time_auction_start/end, active_lot_id, online_bidding_enabled, debrief_text,
  rating`. Unique: `(house_id, name)`.
  **Géén `source_url`-kolom** — er is nu nergens vastgelegd vanwaar een
  collectie werd geïmporteerd (zie D).
- **`lots`** — `collection_id` (FK), `number, name, slug, discipline, year,
  gender, studbook, sire, dam, photos (jsonb), source_url, catalog_text, …`,
  prijzen, **`lot_type_id` (verplicht, 0013)**, `lot_type_auto`,
  resultaat (`sold, sale_price, buyer_client_id`), withdrawn (0027), en
  live-timing. **`lots.source_url` bestaat al** en is dé stabiele her-
  identificatiesleutel bij her-scrape (samen met `slug` en, voor Fences,
  `fences_id`).

### B.3 De huidige flow "site → scrape → data in de site"

Stap voor stap zoals die vandaag handmatig verloopt:

1. **Frederik kiest mentaal de juiste scraper** op basis van de site. Er is
   **geen dispatcher/registry**; de host→script-kennis zit in zijn hoofd en in
   de scriptcommentaren.
2. **Scraper draaien** (CLI, met argumenten). Elke scraper schrijft een JSON
   `{ meta, horses }` naar `data/<bron>-<sleutel>.json`. Patronen:
   | Familie | Bestand | Techniek | Start (arg-vorm) | Host(s) |
   |---|---|---|---|---|
   | **weauction** (Angular SPA) | `scrape-weauction.mjs`, `scrape-weauction-tenant.mjs` | **Puppeteer** | `<auction-url> <house> [collection]` | `bid.aloga-auction.com`, `bid.wefsporthorseauction.com`, `*.weauction.nl`, `swbauction.swb.org`, `bid.dewoldensummersale.com` |
   | **Fences** | `scrape-fences-catalogus.mjs` | `fetch` + HTML-regex | `<vente-slug> [jaar]` | `www.fences.fr/cheval/vente/<slug>/` |
   | **Fences 4D-API** (afgesloten) | `scrape-fences-ventes.mjs` | `fetch` 4D-API | `<jaar|all>` | `www.fences.fr` (`get-4D-Data-ajax.php`) |
   | **PWB** (white-label) | `scrape-pwb.mjs` | `fetch` + regex | `<collectie-url>` | `horseauctionbelgium.com/collectie/<id>`, `paardenveilingonline.com/collectie/<id>` |
   | **Livesauction (Pweb)** | `scrape-livesauction.mjs` | `fetch` + regex | `<base> <auction-id> <house> [coll]` | `334sporthorsestud.com`, `woodlandsinternational.eu` |
   | **Zangersheide** | `scrape-zangersheide.mjs` | `fetch` + regex | `<collection-slug>` | `www.zangersheide.com/nl/auctions/<slug>` |
   | **Schuttert** | `scrape-schuttert.mjs` | `fetch` + regex | `<jaar>` | `schuttertsportsales.com/lot-category/<jaar>/` |
   | **Starsale** | `scrape-starsale.mjs` | `fetch` + regex | `<jaar>` | `www.starsaleauctions.com/veulens/...` |
   | **Olympic Dream** | `scrape-olympic-dream-auction.mjs` | `fetch` + regex | *(geen — vaste URL)* | `www.jumpingschrodertwente.nl/olympic-dream-auction` |
3. **Frederik kijkt de JSON na** (compleetheid). Fences markeert onvolledigheid
   expliciet: `scrape-fences-catalogus.mjs` zet `meta.stopped_reason` en
   `import-fences-catalogus.mjs:20-23` **weigert te importeren** als dat veld
   gevuld is. De meeste andere scrapers hebben **geen** zo'n guard (all-or-
   nothing).
4. **Importeren** met `scripts/import-lots.mjs` (of de Fences-variant):
   - **upsert `auction_houses`** op `name` (`import-lots.mjs:41-56`); house-naam
     uit `meta.house` of het eerste woord van `meta.collection`;
   - **upsert `collections`** op `(house_id, name)` (`:58-72`);
   - **lot_type auto-afleiding** uit jaar/discipline (`:85-111`);
   - **dubbele-import-guard**: stopt als de collectie al lots heeft
     (`:115-125`, `count > 0` → abort);
   - **bulk-insert lots** (`:128-188`). `source_url` wordt ook in `url_extra`
     gezet zodat het cockpit-bronlogo direct werkt (`:152`).

### B.4 Frontend — waar de feature landt

- **Routes** (`src/App.jsx`): `/` (`HousesPage`), `/houses/:houseId`
  (`HousePage`), `/collections/:collectionId` (`CollectionPage`),
  `/collections/:id/clients`, `/collections/:id/summary`,
  `/cockpit/:collectionId`, `/lots/:lotId`.
- **`HousePage.jsx`** — laadt collecties met
  `supabase.from('collections').select(...).eq('house_id', houseId)`, splitst in
  *upcoming* / *past*, en heeft al een **`AddCollectionForm`** (`~:512-568`) die
  een lege collectie aanmaakt via `collections.insert({ name, date, location,
  time_auction_start, house_id })`. **Geen URL-veld.** ⇒ logische plek voor
  "**Collectie via link ophalen**".
- **`CollectionPage.jsx`** — heeft een **action-row** (`~:319-370`:
  🎬 Cockpit · 📊 Overzicht · 📋 Link kopiëren · 💰 Bulk startbedrag ·
  👥 Klanten · lot-types · online-toggle) en een inline **"+ Lot toevoegen"**
  (`~:150-170, 415-429`). ⇒ logische plek voor "**Catalogus (opnieuw) ophalen
  via URL**" voor een bestaande collectie.
- **CRUD-conventie** (`src/lib/breaks.js`, `spotters.js`, `clients.js`):
  een `src/lib/<thema>.js` met `get/create/update/delete`-functies die de
  Supabase-client gebruiken. Dit patroon volgen we voor de scrape-jobs.
- **Auth:** geen login; alles open. **[AANNAME]** dit blijft zo voor nu
  (single-user, Frederik). Voor de worker betekent dat: de worker mag met de
  publishable key werken, maar het is netter hem een eigen key te geven — zie K.

---

## C. Voorgestelde architectuur — wáár draait de scrape

### C.0 De kernbeslissing (techniek, beslis ik zelf — CLAUDE.md §11)

We hebben 13 **bestaande, in productie beproefde** Node/Puppeteer-scrapers over
~12 sites. De robuuste keuze is om die **ongewijzigd te hergebruiken** en er
géén tweede implementatie naast te bouwen. Daarom:

> **Een wachtrij-tabel `scrape_jobs` in Supabase + een worker die de bestaande
> scraper-CLI's aanroept.** De frontend schrijft alleen een job-rij (de geplakte
> URL + de huis-context); een **worker** pikt de job op, kiest via een
> **scraper-registry** het juiste script, draait het, ingest het resultaat en
> schrijft de status terug. De SPA toont de voortgang **live via Supabase
> realtime** op diezelfde rij.

**Waarom deze aanpak (afgewogen tegen de alternatieven):**

| Optie | Waarom niet (of: waarom dit deel) |
|---|---|
| **Vercel serverless function** scrapet rechtstreeks | Puppeteer-Chrome past niet in een serverless-bundel zonder `@sparticuz/chromium`-gedoe; en een scrape van 76 detailpagina's (`scrape-fences-catalogus.mjs` doet 600 ms sleep/pagina ⇒ ~45 s+) **overschrijdt de functie-timeout** (Hobby 10 s, Pro 60 s). Lange jobs horen niet in request/response. |
| **Supabase Edge Function** scrapet rechtstreeks | Deno-runtime; **geen Puppeteer**; de bestaande `.mjs`-scrapers (Node-API's, `child_process`) zouden volledig herschreven moeten worden. Wél bruikbaar als *trigger* — maar dat lost het "waar draait Chrome"-probleem niet op. |
| **Worker die de bestaande CLI's `spawn`t** | **Gekozen.** Nul herschrijving van scrapers; de worker doet exact wat Frederik nu met de hand doet (`scrape-* → import-lots`). Geen timeout-limiet. |
| **Queue = aparte dienst (Redis/SQS/…)** | Overkill; voegt infra + kosten + secrets toe. Supabase is er al, geeft **wachtrij + audit-spoor + realtime status** gratis. |

**Wáár draait de worker?** Gefaseerd, met een bewust lage drempel eerst:

- **Fase 1 (nu bruikbaar, geen nieuwe hosting):** een **lokale worker** op een
  Mac van Frederik — `bin/scrape-worker.mjs` — die de `scrape_jobs`-tabel pollt
  (of via realtime luistert) en jobs uitvoert. Dit is de enige plek waar Chrome,
  `node_modules` én `.env.local` samen staan, en sluit aan bij de bestaande
  realiteit ("Frederik draait dingen lokaal"). De worker start als
  `npm run worker` of als **launchd login-item** zodat hij vanzelf meedraait.
- **Fase 2 (optioneel, later):** dezelfde worker naar een **always-on
  omgeving** (kleine VM / Render/Railway background worker / self-hosted Mac
  mini) zodat Frederiks laptop niet aan hoeft te staan. **Geen code-verandering**
  aan de worker — alleen waar hij draait. Kostenafweging: zie K.

> **[AANNAME]** Voor de korte termijn (en zeker richting de eerstvolgende
> collectie) is "worker op de Mac mini die altijd aanstaat" voldoende. Dat
> bevestig ik graag bij Frederik als productkeuze (techniek beslis ik, maar
> "moet je laptop hiervoor aanstaan?" is een werkstroom-vraag).

### C.1 Eind-tot-eind-flow (gekozen ontwerp)

```
[SPA] HousePage / CollectionPage
   │  Frederik plakt URL → live validatie tegen de registry (welk huis/scraper?)
   ▼
[Supabase] INSERT scrape_jobs { status:'queued', source_url, house_id, ... }
   │  (frontend doet enkel deze insert — verder niets)
   ▼
[Worker] claimt job (status 'queued'→'running', atomisch) ── realtime ──▶ [SPA] toont "bezig"
   │  1. registry.match(url) → { scraper, args, house, collection-strategie }
   │  2. spawn scraper-CLI → data/<bron>.json  (+ voortgang naar job.progress)
   │  3. compleetheidscheck (meta.stopped_reason / horses.length)
   │  4. spawn import-lots.mjs (of Fences-variant) → upsert house+collection, insert lots
   │  5. dedup/idempotentie (zie H.4)
   ▼
[Worker] UPDATE scrape_jobs { status:'done'|'failed', collection_id, lots_imported, log }
   │  ── realtime ──▶
   ▼
[SPA] toont "✓ 76 lots geladen" + link naar de collectie  (of nette foutmelding)
```

De collectie die hieruit ontstaat is een **gewone `collections`-rij** en stroomt
dus naadloos in cockpit, overzicht en — zodra gebouwd — de **dag-opsplitsing**
(`docs/plan-meerdaagse-collectie-opsplitsing.md`, zie I.6).

---

## D. Datamodel / migraties

Twee additieve, backward-compatible wijzigingen. **Backup vóór elke migratie**
(projectregel). Volgende vrije nummer: **`0031`** (laatste is `0030`).

### D.1 `collections.source_url` (additief)

```sql
-- 0031_collection_source_url.sql
alter table collections add column if not exists source_url text;
comment on column collections.source_url is
  'Bron-URL waarvan deze collectie via de URL-ingest is opgehaald (nullable).';
```

Vastleggen vanwaar een collectie kwam — nodig voor "opnieuw ophalen" en voor
deduplicatie op collectie-niveau.

### D.2 `scrape_jobs` (nieuwe tabel — wachtrij + audit-spoor)

```sql
-- 0032_scrape_jobs.sql
create table scrape_jobs (
  id            uuid primary key default gen_random_uuid(),
  source_url    text not null,
  house_id      uuid references auction_houses(id) on delete set null,
  collection_id uuid references collections(id) on delete set null, -- doelcollectie (bij "opnieuw ophalen") of resultaat
  scraper_key   text,            -- door registry bepaald, bv. 'weauction' / 'fences-catalogus'
  mode          text not null default 'create', -- 'create' (nieuwe collectie) | 'refresh' (bestaande vullen)
  status        text not null default 'queued', -- queued | running | done | failed | canceled
  progress      jsonb,           -- { scraped, expected, phase } voor de voortgangsbalk
  lots_imported int,
  log           text,            -- mensvriendelijke stappen + scraper-stdout-staart
  error         text,            -- korte foutmelding voor de UI
  attempts      int not null default 0,
  created_by    text,            -- 'frederik' (toekomst: user-id); audit
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);
create index idx_scrape_jobs_status  on scrape_jobs(status);
create index idx_scrape_jobs_house   on scrape_jobs(house_id);
create index idx_scrape_jobs_created on scrape_jobs(created_at desc);

-- RLS permissive, consistent met de rest van het schema (MVP, single-user)
alter table scrape_jobs enable row level security;
create policy scrape_jobs_all on scrape_jobs for all using (true) with check (true);
```

**Audit-discipline (CLAUDE.md §8):** een `scrape_jobs`-rij wordt **nooit
overschreven om historie te wissen**. Elke nieuwe poging is een **nieuwe rij**
(her-scrape = nieuwe job die naar dezelfde `collection_id` kan wijzen). De
`status`/`progress`/`log`-velden van één rij worden tijdens *die* run wel
bijgewerkt (dat is de live-status, geen correctie van een fout). Zo blijft de
volledige ingest-historie per collectie zichtbaar.

> **[AANNAME]** `gen_random_uuid()` is beschikbaar (pgcrypto/pg13+) — de
> bestaande migraties gebruiken hetzelfde patroon, dus dit klopt met de DB.

---

## E. API / contract

Er komt **geen klassiek REST-endpoint** bij (geen backend). Het "contract"
tussen frontend en worker is de **`scrape_jobs`-tabel** zelf, via de
Supabase-client:

- **Frontend → systeem:** `insert into scrape_jobs(...)` (= "start een ingest").
- **Systeem → frontend:** de SPA **abonneert** op die rij via Supabase
  realtime (`supabase.channel(...).on('postgres_changes', { table:'scrape_jobs',
  filter:'id=eq.<jobId>' })`) en rendert `status`/`progress`/`error` live.
- **Frontend → systeem (annuleren):** `update scrape_jobs set status='canceled'`
  als de job nog `queued` is (de worker negeert geannuleerde jobs).

**[AANNAME]** Supabase realtime staat aan voor het project (of kan per tabel
aangezet worden). Zo niet, dan valt de UI terug op **polling** (elke ~2 s de rij
herlezen) — functioneel gelijkwaardig, iets minder elegant. Beide paden bouwen
we defensief.

Worker-zijde: de worker gebruikt de Supabase-client (`@supabase/supabase-js`,
al een dependency) met **de service-role key in zijn eigen `.env`** (niet de
publishable key, want hij draait serverside-achtig). Hij `spawn`t de scrapers
met `--env-file=.env.local` precies zoals nu handmatig.

---

## F. Frontend

### F.1 Nieuwe lib `src/lib/scrapeJobs.js`

Volgt het `breaks.js`-patroon:

```js
import { supabase } from './supabase'

export async function createScrapeJob({ sourceUrl, houseId, collectionId = null, mode = 'create' }) {
  const { data, error } = await supabase.from('scrape_jobs')
    .insert({ source_url: sourceUrl.trim(), house_id: houseId, collection_id: collectionId, mode, status: 'queued', created_by: 'frederik' })
    .select().single()
  if (error) throw error
  return data
}
export async function getRecentJobs(houseId) { /* select … eq house_id … order created_at desc limit 10 */ }
export async function cancelJob(id) { /* update status='canceled' where id and status='queued' */ }
export function subscribeJob(id, onChange) { /* supabase.channel + postgres_changes, fallback: polling */ }
```

### F.2 URL-validatie in de browser (vóór de job aangemaakt wordt)

De **scraper-registry** (G) komt in een **gedeelde, browser-importeerbare**
module `src/lib/scraperRegistry.js` (pure data + `new URL()`-matching, geen
Node-API's). De UI gebruikt die om **direct feedback** te geven:

- ✅ herkend: "**weauction**-collectie van **Aloga Auction** — klaar om op te
  halen." (registry → scraper + huisnaam-hint)
- ⚠️ host herkend maar dit huis staat nog niet in de site: bied aan het huis aan
  te maken (of kies bestaand huis).
- ❌ **geen scraper** voor deze site: zie F.4.
- ❌ geen geldige URL / verkeerd pad (bv. PWB verwacht `/collectie/<id>`): toon
  wat er verwacht wordt.

De worker gebruikt **dezelfde** registry-module serverside — één bron van
waarheid, geen dubbele mapping.

### F.3 Plaatsing in de UI

**(a) `HousePage.jsx` — "Collectie via link ophalen" (primaire ingang).**
Naast de bestaande "Veiling toevoegen" een knop **"🔗 Collectie via link
ophalen"** die een **modal** opent (hergebruik `src/components/Modal.jsx`):

- veld **Collectie-URL** (auto-save-loos, knop-gestuurd; één duidelijke
  "Ophalen"-knop — geen Enter-verplichting, conform de geleerde les bij
  `SpottersField`);
- **live registry-feedback** onder het veld (F.2);
- optioneel **collectie-naam** (anders leidt de scraper/`import-lots` die zelf
  af uit `meta.collection`);
- **"Ophalen"** → `createScrapeJob({ sourceUrl, houseId, mode:'create' })` →
  modal toont meteen de **statusweergave** (F.5).

**(b) `CollectionPage.jsx` — "Catalogus ophalen via URL" (refresh-ingang).**
Knop in de action-row (`~:319-370`) voor een **bestaande** (vaak lege `planned`)
collectie: zelfde modal, maar `mode:'refresh'` en `collectionId` meegegeven, met
`source_url` voorgevuld als de collectie er al een heeft. Bedoeld voor:
"ik heb de collectie al aangemaakt, vul hem nu met lots van deze link" en voor
"haal opnieuw op" zodra de site is bijgewerkt.

### F.4 Veilinghuis zonder bestaande scraper

De registry geeft `null`. De UI:

1. legt rustig uit dat er **nog geen scraper** is voor deze site;
2. **slaat de URL toch op** als job met `status:'queued'`, `scraper_key:null`
   (of als notitie op het huis) zodat niets verloren gaat;
3. toont: "Claude Code voegt een scraper toe voor deze site." → dit is precies
   de bestaande werkwijze (Co-work → Claude Code bouwt een nieuwe
   `scrape-<site>.mjs` volgens het bestaande patroon en registreert hem). De
   job kan daarna opnieuw gestart worden zonder dat Frederik de URL kwijt is.

### F.5 Statusfeedback / voortgang

In de modal (en als compacte regel in een **"Recente imports"-lijstje** op
`HousePage`):

- **In wachtrij** — spinner + "wacht op de worker" (+ "Annuleer" als nog queued).
- **Bezig** — voortgangsbalk uit `progress.scraped / progress.expected` +
  fase-tekst ("catalogus lezen", "lot 34/76", "importeren").
- **Klaar** — "✓ 76 lots geladen in *La Vente de Sélection Deauville 2026*" +
  knop **"Open collectie →"** (`/collections/:id`).
- **Mislukt** — korte `error` in mensentaal + inklapbare `log`-details +
  **"Opnieuw proberen"** (maakt een nieuwe job, audit-veilig).
- **Worker offline?** Als een job lang `queued` blijft: hint "de
  import-worker draait niet — start hem op de Mac (`npm run worker`)".

---

## G. Scraper-registry / selectie

### G.1 `src/lib/scraperRegistry.js` (gedeeld: browser + worker)

Eén declaratieve mapping host/URL-patroon → scraper. Bevat **geen** Node-API's
zodat de browser hem kan importeren voor validatie (F.2). Vorm:

```js
// elk item: hoe herkennen we de site, welk script, welke args, hoe heet het huis
export const SCRAPERS = [
  { key: 'weauction',
    match: (u) => /(^|\.)weauction\.nl$/.test(u.hostname)
               || /^bid\.(aloga-auction|wefsporthorseauction|dewoldensummersale)\.com$/.test(u.hostname)
               || u.hostname === 'swbauction.swb.org',
    script: 'scrape-weauction.mjs',
    // weauction vereist <auction-url> <house> [collection]; house uit context/registry-hint
    args: ({ url, houseName }) => [url, houseName],
    needsHouseName: true, engine: 'puppeteer' },

  { key: 'fences-catalogus',
    match: (u) => u.hostname.endsWith('fences.fr') && /\/cheval\/vente\//.test(u.pathname),
    script: 'scrape-fences-catalogus.mjs',
    args: ({ url }) => [ slugFromFencesUrl(url) ],   // vente-slug uit /cheval/vente/<slug>/
    importer: 'import-fences-catalogus.mjs',          // afwijkende importer
    engine: 'fetch' },

  { key: 'pwb',
    match: (u) => /\/collectie\/\d+/.test(u.pathname)
               && /(horseauctionbelgium|paardenveilingonline)\.com$/.test(u.hostname),
    script: 'scrape-pwb.mjs', args: ({ url }) => [url], engine: 'fetch' },

  { key: 'zangersheide',
    match: (u) => u.hostname.endsWith('zangersheide.com') && /\/auctions\//.test(u.pathname),
    script: 'scrape-zangersheide.mjs', args: ({ url }) => [ zhSlug(url) ], engine: 'fetch' },

  { key: 'livesauction',
    match: (u) => /(334sporthorsestud\.com|woodlandsinternational\.eu)$/.test(u.hostname),
    script: 'scrape-livesauction.mjs', needsHouseName: true, engine: 'fetch',
    args: ({ url, houseName }) => liveAuctionArgs(url, houseName) }, // base + id uit URL

  { key: 'schuttert',
    match: (u) => u.hostname.endsWith('schuttertsportsales.com'),
    script: 'scrape-schuttert.mjs', args: ({ url }) => [ yearFrom(url) ], engine: 'fetch' },

  { key: 'starsale',
    match: (u) => u.hostname.endsWith('starsaleauctions.com'),
    script: 'scrape-starsale.mjs', args: ({ url }) => [ yearFrom(url) ], engine: 'fetch' },

  { key: 'olympic-dream',
    match: (u) => u.hostname.endsWith('jumpingschrodertwente.nl'),
    script: 'scrape-olympic-dream-auction.mjs', args: () => [], engine: 'fetch' },
]

export function matchScraper(rawUrl) {
  let u; try { u = new URL(rawUrl) } catch { return { ok:false, reason:'invalid_url' } }
  const hit = SCRAPERS.find(s => s.match(u))
  return hit ? { ok:true, scraper:hit, url:u } : { ok:false, reason:'no_scraper', url:u }
}
```

`slugFromFencesUrl`, `zhSlug`, `liveAuctionArgs`, `yearFrom` zijn kleine pure
helpers die de bestaande arg-afleiding (nu in de scriptkoppen) formaliseren.

> **Belangrijk ontwerpdetail:** sommige scrapers (Schuttert, Starsale) nemen nu
> een **jaar** i.p.v. een URL, en Fences neemt een **slug**. De registry vertaalt
> de geplakte URL naar de juiste arg-vorm. Waar dat niet betrouwbaar uit de URL
> af te leiden is, vraagt de UI het kleine ontbrekende stukje (bv. jaar) na —
> **[AANNAME]** voor Schuttert/Starsale is het jaar uit het URL-pad te halen
> (`/lot-category/2026/`, `/veulens/...-2026`); te verifiëren.

### G.2 Huisnaam-resolutie

Scrapers als weauction/livesauction vereisen een **huisnaam**-arg. Bron, in
volgorde:
1. de **context** (we zitten al in een huis op `HousePage` → `auction_houses.name`);
2. anders een **registry-hint** per host (bv. `bid.aloga-auction.com` → "Aloga");
3. anders de door Frederik ingevulde naam in de modal.
De huisnaam wordt sowieso ook door `import-lots.mjs` ge-upsert via `meta.house`,
dus een kleine mismatch zelf-corrigeert op `(house_id, name)`-niveau.

---

## H. Jobs / queue / worker

### H.1 `bin/scrape-worker.mjs` (nieuw)

Een klein, lang-lopend Node-proces. Pseudostructuur:

```
loop (realtime-getriggerd, met polling-fallback elke ~5 s):
  job = claimNextQueued()                 // atomair: update status 'queued'→'running'
  if (!job) continue
  try {
    { scraper, args, importer } = registry.match(job.source_url)   // dezelfde module als de UI
    if (!scraper) → fail(job, 'no_scraper')                        // F.4
    setProgress(job, { phase:'scrapen' })
    outFile = run(scraper.script, args)    // spawn `node --env-file=.env.local scripts/<script> …`
                                           // stream stdout → job.log + job.progress (regex op "lot X/Y")
    assertComplete(outFile)                // meta.stopped_reason? horses.length>0?
    setProgress(job, { phase:'importeren' })
    res = run(importer ?? 'import-lots.mjs', [outFile])
    finish(job, { status:'done', collection_id, lots_imported })
  } catch (e) { fail(job, humanize(e)) }   // status 'failed', error + log
```

- **`claimNextQueued`** doet een conditionele update (`update … set
  status='running', started_at=now() where id=<oudste queued> and
  status='queued'`) zodat **twee workers nooit dezelfde job** pakken
  (idempotentie/concurrency, ook al draaien we voorlopig één worker).
- **Voortgang:** de worker leest scraper-stdout regel voor regel. We voegen aan
  de scrapers een **uniform, machineleesbaar voortgangsregel-conventie** toe
  (klein, veilig: bv. `console.error('PROGRESS 34/76')`) zodat
  `progress.scraped/expected` betrouwbaar te vullen is. Bestaande
  mens-logs blijven. **[AANNAME]** dit is een minimale toevoeging per scraper.
- **Output-pad:** de worker hoeft het JSON-pad niet te raden. We laten elke
  scraper als **laatste stdout-regel** `OUT=<pad>` printen (kleine, uniforme
  toevoeging), of — als we de scrapers in fase 1 echt onaangeraakt willen —
  leidt de worker het pad af uit de bekende naamgevingsconventie per scraper
  (`data/<bron>-<sleutel>.json`). **Aanbeveling:** de `OUT=`-regel toevoegen;
  het is robuuster dan padconventies herhalen.

### H.2 Sync vs async

**Async, altijd.** De frontend-insert keert onmiddellijk terug; de scrape draait
losgekoppeld. Dit is verplicht door de looptijd (Puppeteer + tientallen
pagina's) en geeft meteen herstart-/audit-mogelijkheden.

### H.3 Herstart bij falen

- **Mislukte job blijft `failed`** met `error`+`log` (audit). "Opnieuw proberen"
  in de UI maakt een **nieuwe** job (geen overschrijving — CLAUDE.md §8).
- **Worker-crash midden in een run:** een job die te lang `running` staat
  (> N minuten, configureerbaar) wordt door de worker bij opstart **teruggezet
  naar `queued`** (met `attempts++`) of, na te veel pogingen, op `failed` gezet.
- **`attempts`-plafond** voorkomt eindeloos opnieuw proberen van een structureel
  kapotte bron.

### H.4 Idempotentie & deduplicatie

Twee niveaus, beide leunen op bestaande mechanismen:

1. **Collectie-niveau (bestaat al):** `import-lots.mjs:115-125` en
   `import-fences-catalogus.mjs:38-40` **breken af als de collectie al lots
   heeft**. Dat voorkomt dubbele import out-of-the-box. Voor de
   **refresh/her-scrape**-modus is dat te grof — zie punt 2.
2. **Lot-niveau (uit te breiden voor `mode:'refresh'`):** match nieuwe paarden op
   een **stabiele sleutel** in deze volgorde — `lots.source_url` →
   `slug` → (Fences) `fences_id` → `(name, sire, dam)`. Bestaande lots
   **updaten** i.p.v. dupliceren; nieuwe **toevoegen**; verdwenen lots
   **markeren** (niet hard verwijderen — sluit aan bij de withdrawn-logica 0027
   en het audit-principe). Dit is precies de **stabiele-sleutel-match** die het
   meerdaagse-plan ook voorschrijft (C.6 daar), dus we bouwen één gedeelde
   merge-helper.

> **[AANNAME]** Voor de eerste versie volstaat **`mode:'create'`** met de
> bestaande grove guard; de fijne lot-merge (`mode:'refresh'`) is een
> aparte, latere fase (I.5) omdat hij raakt aan handmatig ingevulde data
> (notities/USP's mogen nooit overschreven worden).

### H.5 Foutafhandeling & logging

- **Compleetheid:** worker respecteert `meta.stopped_reason` (Fences) en
  controleert `horses.length`; bij twijfel → `failed` met uitleg, **geen
  half-import**. Voor scrapers zonder guard voegen we minimaal een
  `expected vs scraped`-check toe.
- **Rate-limiting / Cloudflare:** bestaande scrapers gebruiken al sleeps en een
  `User-Agent` (`scrape-pwb.mjs:35`). Bekend geparkeerd: Hippomundo/Horse Telex
  zitten achter Cloudflare (PROJECT_STATUS) — die horen **niet** in de registry;
  de UI meldt netjes "geen scraper". Bij HTTP 5xx/429 doet de worker een
  beperkte **retry met backoff** vóór hij `failed` zet (de oorspronkelijke 500/
  529-problemen waren tijdelijk).
- **Mens-vriendelijke `error`:** de worker vertaalt technische fouten naar één
  zin voor de UI (bv. "De site gaf een tijdelijke fout (500) — probeer het zo
  opnieuw."), met de ruwe `log` inklapbaar eronder.

---

## I. Gefaseerd implementatieplan (Claude-Code-klaar)

Elke fase eindigt met een groene `npm run build` en is op zichzelf bruikbaar.
Per fase: **backup vóór migratie**, **plan vóór feature**, **build-check vóór
commit**, kleine stappen met visuele bevestiging.

### Fase 1 — Datamodel + registry (geen gedragsverandering)
- [ ] `supabase/migrations/0031_collection_source_url.sql` (D.1). **Backup eerst.**
- [ ] `supabase/migrations/0032_scrape_jobs.sql` (D.2) + RLS-policy.
- [ ] `src/lib/scraperRegistry.js` (G) — pure, browser+worker-deelbaar; met
      unit-test-fixtures van échte URLs per familie.
- **Test:** registry herkent elke bekende host correct en geeft `no_scraper`
  voor een onbekende; migraties draaien schoon; bestaande tellingen onveranderd.

### Fase 2 — Worker die bestaande scrapers aanstuurt
- [ ] `bin/scrape-worker.mjs` (H.1): claim-loop, registry-match, `spawn` scraper
      + importer, status/log/progress terugschrijven, crash-recovery (H.3).
- [ ] `npm run worker`-script in `package.json`; doc in `DEVELOPER_SETUP.md`
      (+ optioneel launchd-plist voor auto-start).
- [ ] Kleine, uniforme toevoeging per scraper: `PROGRESS x/y` + `OUT=<pad>`
      stdout-conventie (H.1) — additief, breekt bestaande handmatige runs niet.
- **Test:** job met de hand in `scrape_jobs` zetten (één bekende weauction- én
  één Fences-URL) → worker draait → lots verschijnen → status `done`; een
  onbekende URL → `failed:no_scraper`; worker-herstart hervat een vastgelopen
  `running`-job.

### Fase 3 — Frontend: plakken, valideren, status tonen
- [ ] `src/lib/scrapeJobs.js` (F.1) + realtime/polling-subscribe.
- [ ] `HousePage.jsx`: knop **"🔗 Collectie via link ophalen"** + modal
      (F.3a) met live registry-validatie (F.2) en statusweergave (F.5).
- [ ] `CollectionPage.jsx`: action-row-knop **"Catalogus ophalen via URL"**
      (`mode:'refresh'`, F.3b).
- [ ] "Recente imports"-lijstje op `HousePage` (laatste N jobs van dit huis).
- **Test:** end-to-end vanuit de browser op een echte aankomende collectie
  (bv. een PWB- of weauction-URL): plakken → bezig → "✓ N lots" → collectie
  opent; foutpad toont nette melding + "opnieuw proberen"; geen Enter-
  verplichting in het URL-veld.

### Fase 4 — Robuustheid & "geen scraper"-pad
- [ ] Retry/backoff bij 5xx/429 (H.5); `attempts`-plafond.
- [ ] "Geen scraper voor deze site"-pad (F.4): URL bewaren als queued-job met
      `scraper_key:null`, duidelijke boodschap, klaar voor Claude Code om een
      nieuwe `scrape-<site>.mjs` toe te voegen + 1 regel in de registry.
- [ ] Annuleren van een nog-queued job (E).
- **Test:** geforceerde 500 → nette retry-melding; onbekende site → URL niet
  kwijt; annuleren werkt.

### Fase 5 (later) — Refresh-merge op lot-niveau
- [ ] Gedeelde merge-helper (H.4 punt 2) met stabiele-sleutel-match; **nooit**
      handmatige velden (notities/USP/prijzen) overschrijven; verdwenen lots
      markeren i.p.v. verwijderen (audit). Deelt code met de meerdaagse-plan-
      her-scrape.
- **Test:** her-scrape van een gewijzigde bron voegt enkel nieuwe lots toe,
  bewaart handmatige data, logt verschuivingen.

### Fase 6 (later, optioneel) — Worker naar always-on hosting
- [ ] Dezelfde `bin/scrape-worker.mjs` op een always-on omgeving (Mac mini /
      kleine VM) zodat de import werkt zonder dat Frederiks laptop aanstaat.
      **Geen code-verandering** — alleen runtime + secrets. Kostenafweging in K.

### Latere opruiming / samenhang
- [ ] Documenteren in `DEVELOPER_SETUP.md` + `PROJECT_STATUS.md` (drie-docs-set).

---

## I.6 Samenhang met de dag-opsplitsing (`plan-meerdaagse-collectie-opsplitsing.md`)

De twee features grijpen op precies twee punten in elkaar:

1. **Een via-link binnengehaalde collectie is een gewone `collections`-rij.**
   Zodra de dag-opsplitsing er is, krijgt élke collectie automatisch **één
   `collection_day`** (de backfill/standaard uit dat plan, fase 1 daar). Een
   geplakte collectie stroomt dus zonder extra werk de dag-flow in: standaard
   één dag, en Frederik kan ze daarna in dagen splitsen.
2. **Eén gedeelde her-scrape-merge.** Beide plannen vereisen het **behoud van
   handmatige toewijzingen bij her-scrape** via een **stabiele sleutel**
   (`source_url`/`slug`/`fences_id`). Het meerdaagse-plan wil de
   `collection_day_id` behouden; dit plan wil notities/USP's behouden. We bouwen
   **één merge-helper** die beide dient (dit plan I.5 = meerdaagse-plan C.6),
   zodat een meerdaagse, via-link opgehaalde Fences-verkoop (bv. **Deauville
   Sélection**, 2 dagen, één catalogus-URL `/cheval/vente/selection/`) end-to-end
   werkt: plak-link → ingest → dag-opsplitsing → her-scrape behoudt beide.

**Aanbevolen volgorde:** de schema-fasen kunnen onafhankelijk; bouw de
**gedeelde merge-helper één keer** (op het kruispunt van I.5 hier en C.6 daar)
in plaats van twee keer.

---

## J. Teststrategie

- **Registry (puur, snelst):** fixture-lijst van échte URLs per familie →
  verwacht `scraper_key`; plus negatieve gevallen (Hippomundo/Cloudflare →
  `no_scraper`, ongeldige URL → `invalid_url`, fout PWB-pad → afgewezen).
- **Worker (integratie, handmatig + scriptbaar):** job-rij prikken voor één
  `fetch`-scraper (snel, bv. PWB/Zangersheide) en één **Puppeteer**-scraper
  (weauction) → controleer `done`, `lots_imported`, dat lots in Supabase staan,
  en dat de dubbele-import-guard een tweede `create`-job netjes stopt.
- **Foutpaden:** geforceerde 5xx (retry → nette melding), onvolledige Fences-
  scrape (`stopped_reason` → `failed`, géén half-import), onbekende site
  (`no_scraper`, URL bewaard), annuleren van queued job, worker-crash-recovery.
- **Frontend:** visuele test door Frederik (hij is de finale review-instantie) —
  plakken op een echte aankomende collectie, voortgangsbalk, "Open collectie →",
  foutmelding + "opnieuw proberen", geen Enter-verplichting in het URL-veld
  (regressie op de `SpottersField`-les).
- **Regressie:** bestaande handmatige CLI-flow (`scrape-* → import-lots`) blijft
  ongewijzigd werken (de `PROGRESS`/`OUT=`-regels zijn additief).
- **Build-check** (`npm run build`) groen vóór elke commit.

---

## K. Open vragen en risico's

1. **Waar draait de worker (werkstroom-vraag aan Frederik).** Fase 1 = lokaal op
   een Mac. Moet je laptop daarvoor aanstaan, of zetten we de worker op de Mac
   mini die altijd aan is? (Techniek beslis ik; "welke Mac/aan-laten-staan" is
   jouw keuze.) Fase 6 (echte hosting) heeft een kleine **kost** — afwegen tegen
   het gemak van "altijd beschikbaar".
2. **Secrets voor de worker.** De worker hoort de **service-role key** te
   gebruiken (niet de publishable key), in zijn eigen lokale `.env` — **nooit in
   git**, conform de bestaande `.env.local`-discipline. **[AANNAME]** dat is
   acceptabel omdat de worker niet in de browser draait.
3. **Realtime aan?** Als Supabase realtime niet aanstaat voor `scrape_jobs`,
   valt de UI terug op polling. Te bevestigen in het Supabase-dashboard.
4. **Arg-afleiding uit de URL** voor Schuttert/Starsale (jaar) en Fences (slug):
   **[AANNAME]** betrouwbaar uit het pad te halen; te verifiëren met echte URLs.
   Waar niet, vraagt de modal het kleine ontbrekende stukje na.
5. **Veilinghuis zonder scraper** is geen fout maar een bekend pad (F.4): URL
   bewaren, Claude Code voegt een scraper + registry-regel toe. Dit is de
   normale uitbreidingsroute en kost weinig dankzij de uniforme scraper-vorm.
6. **Auth/permissies.** Zolang er geen login is, kan iederéén met de site-URL een
   job aanmaken. Voor single-user Frederik nu acceptabel; bij meer gebruikers
   wordt auth + per-rol-RLS nodig (los traject).
7. **Cloudflare/anti-bot bronnen** (Hippomundo, Horse Telex) blijven buiten
   scope — geen scraper, nette UI-melding.
8. **Naamgeving/terminologie** (product-vraag): "Collectie via link ophalen" en
   "Catalogus ophalen via URL" als knopteksten — kort bevestigen.

---

## Samenvatting

- **Kernbevinding:** Veiling Pro heeft **geen backend** — statische SPA +
  Supabase + **13 lokale Node/Puppeteer-scrapers** die Frederik handmatig draait,
  en er is **geen scraper-registry** (de host→script-keuze zit in zijn hoofd).
  Een statische site kan zelf niet scrapen, en lange Puppeteer-scrapes passen
  niet in serverless-functies.
- **Ontwerp:** de SPA schrijft alleen een **`scrape_jobs`-rij** (geplakte URL +
  huis-context); een **worker** pikt die op, kiest via een **gedeelde
  scraper-registry** (`src/lib/scraperRegistry.js`) het juiste bestaande script,
  `spawn`t het + `import-lots.mjs` precies zoals nu handmatig, en schrijft
  status/voortgang terug; de SPA toont dat **live via Supabase realtime**. Zo
  worden alle bestaande scrapers **ongewijzigd hergebruikt**.
- **Datamodel:** `collections.source_url` (0031) + `scrape_jobs` (0032,
  wachtrij + onuitwisbaar audit-spoor; her-scrape = nieuwe rij).
- **UI:** "🔗 Collectie via link ophalen" op `HousePage` (nieuwe collectie) en
  "Catalogus ophalen via URL" op `CollectionPage` (bestaande vullen/verversen),
  met live URL-validatie, voortgangsbalk en nette foutmeldingen; geen
  Enter-verplichting.
- **Robuustheid:** async job, idempotente claim, retry/backoff bij 5xx/429,
  compleetheidscheck (`stopped_reason`), dedup via de bestaande guard nu +
  stabiele-sleutel-merge later.
- **Samenhang:** een via-link opgehaalde collectie is een gewone collectie en
  stroomt in de **dag-opsplitsing**; beide plannen delen één
  her-scrape-merge-helper op de stabiele sleutel.
- **Gefaseerd:** schema+registry → worker → frontend → robuustheid →
  refresh-merge → (optioneel) always-on hosting.

**Documentpad:** `docs/plan-plak-collectielink-ingest.md`

**Open product-/werkstroom-vragen aan Frederik** (techniek beslis ik zelf):
(1) op welke Mac draait de import-worker, en mag/moet die altijd aanstaan (of
investeren we in always-on hosting)? (2) gebruik je per avond andere spotters/
pauzes — overlapt met het meerdaagse-plan? (3) akkoord met de knopteksten
"Collectie via link ophalen" / "Catalogus ophalen via URL"?
