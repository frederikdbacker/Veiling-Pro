# DEVELOPER_SETUP — Veiling-Pro

**Laatste update: 25 juni 2026 (scrapers + Hippomundo-stamboom + UI-batch; migratie 0036 `archived`)**

> **Nieuw 25 juni 2026.** Scrapers: `scripts/scrape-extrahorses.mjs` (Extra Horses)
> en `scripts/scrape-weauction-api.mjs` (nieuwe weauction/Tailwind-frontend, o.a.
> The Collection — de oude `scrape-weauction.mjs` voor Aloga/WEF blijft naast hem
> bestaan; de registry kiest per host). De weauction-api-scraper haalt ook de
> volledige Hippomundo-stamboom op via Puppeteer (Cloudflare wordt door een echte
> browser opgelost). `scripts/update-pedigree-from-scrape.mjs` patcht pedigree van
> bestaande lots niet-destructief. Migratie **0036** voegt `archived` toe aan
> `collections` + `auction_houses` (additief; gearchiveerde items worden in de UI
> verborgen met een "Toon gearchiveerd"-schakelaar onder "Beheren").

---

## Vereisten

- Node.js 18 of hoger (bij voorkeur 20+; getest op 20.20.2)
- npm
- Git
- Een Supabase-account
- Een Vercel-account
- Claude Code geïnstalleerd

---

## Installatie Claude Code (eenmalig)

```bash
npm install -g @anthropic-ai/claude-code
```

---

## Project klonen

```bash
git clone https://github.com/frederikdbacker/Veiling-Pro.git veiling-pro
cd veiling-pro
npm install
```

---

## Multi-machine sync (Mac mini + MacBook)

Werk je vanaf meerdere Macs aan dit project? Dan is **git/GitHub** het
sync-mechanisme — niet iCloud Drive.

Gebruik hiervoor het veilige script **`bin/sync.sh`** (vaste gewoonte;
Claude doet dit automatisch bij sessiestart en -einde):

- **Begin van werksessie:** `bin/sync.sh pull`
  Haalt de laatste versie op, maar **alleen fast-forward** — kan nooit je
  werk overschrijven en stopt luid als de takken uiteenlopen. (Voorkomt
  het scenario van 18 mei 2026: 70 commits achterlopen zonder het te weten.)
- **Einde van werksessie:** `bin/sync.sh done "korte omschrijving"`
  Draait eerst `npm run build`; commit + push **pas als de build slaagt**.
  Pusht nooit geforceerd. Neemt alleen gevolgde wijzigingen mee; nieuwe
  (untracked) bestanden enkel expliciet met `bin/sync.sh done "tekst" +new`
  (zo sleep je nooit per ongeluk losse bestanden mee).
- **Tussendoor:** `bin/sync.sh status` toont of je voor/achterloopt.
- `git add . && commit && push` met de hand mag nog, maar wordt afgeraden:
  `git add .` neemt ook ongerelateerde losse bestanden mee.
- `.env.local` zit in `.gitignore` (bevat secrets) en wordt **niet**
  gesynchroniseerd via git — kopieer die file apart wanneer je een
  nieuwe machine opzet.

iCloud Drive werd op 5 mei 2026 kort gebruikt en op 6 mei verworpen
omdat `node_modules` corrumpeert tijdens iCloud-sync, `.git/index.lock`
in conflict raakt bij gelijktijdige edits, en bestanden ge-evict
worden door iCloud waardoor builds breken. Niet doen. Zie HANDOVER.md
gotcha #6 voor details.

---

## Omgevingsvariabelen

Maak een `.env.local` bestand aan in de root van het project (Vite-conventie —
deze prefix wordt automatisch genegeerd door git, zie `.gitignore`):

```
VITE_SUPABASE_URL=https://cjxtwzmryrpwoydrqqil.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[jouw publishable key]
```

De publishable key vind je in:
**Supabase Dashboard → Project Settings → API Keys → Publishable key**

(Op oudere Supabase-accounts heet hetzelfde veld nog **anon** onder *Legacy API keys*.
Beide werken; kies degene die jouw dashboard toont.)

⚠️ Zorg dat `.env.local` in `.gitignore` staat. Nooit committen met echte waarden.
De *secret* / *service_role* key NIET hier zetten — die mag nooit in client-code.

---

## Supabase

- **Project URL:** https://cjxtwzmryrpwoydrqqil.supabase.co
- **Project ID:** cjxtwzmryrpwoydrqqil
- **Regio:** Frankfurt (eu-central-1)

> **Migratiebeleid (sinds 24 juni 2026).** *Additieve + idempotente* migraties
> (enkel toevoegen — `add column/table … if not exists`, nieuwe index/policy;
> géén drop, rename of data-mutatie) mogen **automatisch** worden toegepast,
> zonder aparte backup of bevestiging. **Destructieve** migraties (drop/rename/
> data-wijziging) vereisen nog steeds een Supabase-backup én expliciete
> bevestiging vóór uitvoering.

### Schema aanmaken (eenmalig)

1. Ga naar Supabase Dashboard → SQL Editor → New query
2. Plak de inhoud van **alle** migratiebestanden in `supabase/migrations/`
   in volgorde, één per één runnen:
   - `0001_init.sql` — kerntabellen `auction_houses` / `auctions` / `lots`
   - `0002_bid_steps_per_auction.sql` — bid_steps verhuist naar auctions
   - `0003_bid_step_system.sql` — `lot_types`, `auction_lot_types`, `bid_step_rules`
   - `0004_cockpit_and_clients.sql` — `auctions.active_lot_id`,
     `lots.time_bidding_start`, `clients`, `lot_interested_clients`
   - `0005_lot_urls.sql` — drie URL-velden op lots
   - `0006_sale_channel.sql` — `lots.sale_channel`
   - `0007_clients_seating_buyer.sql` — `clients.house_id`,
     `client_auction_seating`, `lots.buyer_client_id`
   - `0008_pedigree.sql` — `lots.pedigree` jsonb (3-generatie tree)
   - `0010_spotters_global.sql` — globale `spotters` + `auction_spotters`
     junction (vervangt 0009 die per-veiling spotters had; 0009 wordt
     overgeslagen want 0010 dropt en herstelt het schema)
   - `0011_auction_breaks.sql` — `auction_breaks` tabel voor pauzes
     (BIS-blokken) tussen lots
   - `0012_online_bidding.sql` — `auctions.online_bidding_enabled` bool
   - `0013`–`0030` — diverse uitbreidingen (o.a. lot_type verplicht 0013,
     rename auctions→collections 0018, withdrawn 0027, sale-corrections 0028)
   - `0031_collection_days.sql` — **veilingdagen**: tabel `collection_days`
     + `lots.collection_day_id` + backfill (één dag per bestaande collectie).
     ⚠️ Backup vóór uitvoeren. Draai vóór de code-deploy.
   - `0032_breaks_per_day.sql` — pauzes per dag (`collection_breaks.collection_day_id`).
     Draai ná 0031.
   - `0033_collection_source_url.sql` — **URL-ingest**: `collections.source_url`
     (bron-URL van een via-link opgehaalde collectie). Additief + idempotent.
   - `0034_scrape_jobs.sql` — **URL-ingest**: wachtrij-/audit-tabel `scrape_jobs`
     + RLS + realtime. Additief + idempotent. Draai ná 0033.
     ⚠️ Backup vóór 0033/0034. Daarna: deploy + start de worker (zie onder).
3. Verifieer in Table Editor dat alle tabellen bestaan:
   - `auction_houses`, `auctions` (met `online_bidding_enabled`), `lots`
   - `lot_types`, `auction_lot_types`, `bid_step_rules`
   - `clients`, `lot_interested_clients`, `client_auction_seating`
   - `spotters`, `auction_spotters`
   - `auction_breaks`

### Data importeren (eenmalig per veiling)

```bash
node --env-file=.env.local scripts/import-lots.mjs data/aloga-2026-import.json
```

Het script:
1. Maakt automatisch een `auction_houses`-record aan (bv. "Aloga")
2. Maakt automatisch een `auctions`-record aan (bv. "Aloga Auction 2026")
3. Voegt alle paarden toe als rijen in `lots`
4. Stopt met een waarschuwing als er al lots staan voor deze veiling
   (geen dubbele import)

---

## Development server starten

```bash
npm run dev
```

De app opent op http://localhost:5173. De homepage toont een lijstje van
auction_houses uit Supabase als verbinding-smoke-test.

---

## Scrape-worker (URL-ingest "Collectie ophalen")

De knop **"Collectie ophalen"** (een link plakken → catalogus automatisch
binnenhalen) werkt enkel als de **worker** draait. De worker is een klein,
lang-lopend Node-proces dat de tabel `scrape_jobs` afleest, de bestaande
scraper- + import-scripts spawnt, en de status terugschrijft. Bedoeld voor de
**Mac mini die altijd aanstaat**.

**Vereist eerst:** migraties 0033 + 0034 toegepast (zie boven).

### Handmatig starten

```bash
cd ~/veiling-pro
npm run worker
```

Hij blijft draaien en logt elke job. Stoppen met Ctrl-C (sluit netjes af).
De worker gebruikt `.env.local` (`VITE_SUPABASE_URL` + een sleutel). Voeg daar
optioneel een `SUPABASE_SERVICE_ROLE_KEY` toe (netter voor een serverside-achtig
proces); zonder valt hij terug op de publishable key. **Service-role key nooit
in git of in client-code.**

### Automatisch starten na herstart (LaunchAgent) — AL GEÏNSTALLEERD op de mini

Sinds **24 juni 2026** draait de worker op de Mac mini als achtergronddienst
(launchd), **niet in een terminalvenster**. Hij start vanzelf op bij inloggen/
herstart (`RunAtLoad`) en herstart zichzelf na een crash (`KeepAlive`); de worker
zet bij opstart vastgelopen jobs zelf terug, dus herstarten is altijd veilig.

- Dienst-bestand op de mini: `~/Library/LaunchAgents/eu.conceptosaurus.veilingpro.worker.plist`
- Sjabloon in de repo (voor een nieuwe machine): `bin/eu.conceptosaurus.veilingpro.worker.plist.example`
- Poll-vangnet staat op 60s; realtime doet de instant-pickup.

### Worker beheren (dagelijks — op de mini)

De worker heeft **geen venster**; zijn "scherm" is een logbestand. Handige commando's:

```bash
# Draait hij? (een getal = PID = ja, hij leeft)
launchctl list | grep veilingpro

# Live meekijken met wat hij doet (Ctrl-C stopt enkel het meekijken, niet de worker)
tail -f ~/veiling-pro/worker.out.log

# Herstarten (bv. na een code-update / git pull)
launchctl kickstart -k gui/$(id -u)/eu.conceptosaurus.veilingpro.worker

# Tijdelijk stoppen
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/eu.conceptosaurus.veilingpro.worker.plist

# Weer starten
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/eu.conceptosaurus.veilingpro.worker.plist
```

Logbestanden: `~/veiling-pro/worker.out.log` (gewone uitvoer) en `worker.err.log`
(fouten). **Voorwaarde:** de mini mag niet in slaap gaan, anders wachten jobs tot
hij wakker is (Systeeminstellingen → Energie → niet automatisch slapen).

> Deze commando's zijn ook altijd opvraagbaar via Claude (Co-work/Code) — die
> lezen dit bestand. Je hoeft ze dus niet te onthouden.

### Hoe het samenhangt

- De host → scraper-keuze staat in `src/lib/scraperRegistry.js` (gedeeld door de
  browser en de worker). Een nieuwe site toevoegen = één scraper + één
  registry-regel. Test met `npm run test:registry`.
- Een via-link opgehaalde collectie is een gewone `collections`-rij en stroomt
  dus in de veilingdagen/cockpit-flow (migraties 0031/0032).

---

## Vercel deployment

**Live URL:** https://veiling-pro.vercel.app

Vercel is gekoppeld aan https://github.com/frederikdbacker/Veiling-Pro.
Elke `git push` naar `main` triggert automatisch een nieuwe deployment.
Geen `vercel` CLI nodig voor dagelijks gebruik — push is voldoende.

### `vercel.json` in repo-root

Bevat een SPA-fallback rewrite zodat directe deeplinks (zoals
`/cockpit/:id` en `/auctions/:id/summary`) niet 404 geven op Vercel:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Niet aanraken tenzij je weet wat je doet — verwijderen breekt alle deeplinks.

### Environment variables in Vercel

Ingesteld via Vercel dashboard → Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Deze waarden komen uit Supabase Dashboard → Settings → API Keys
(Publishable key, niet de secret/service_role).

---

## Claude Code sessie starten

```bash
cd ~/veiling-pro
claude
```

**Eerste opdracht altijd:**
> "Lees PROJECT_STATUS.md, MASTER_PROMPT.md en DEVELOPER_SETUP.md voor context. Werkwijze uit deze documenten geldt onverkort. De gebruiker is niet-technisch, dus klein-stappen-werkwijze met visuele bevestiging na elke stap. Daarna: [concrete taak]."

---

## Sub-agents configuratie

De drie sub-agents leven in `.claude/agents/`:

```
veiling-pro/
└── .claude/
    └── agents/
        ├── builder.md
        ├── data-agent.md
        └── content-agent.md
```

Claude Code leest deze automatisch. Geen verdere configuratie nodig.

> Status 29-04-2026: directory `.claude/agents/` is nog niet aangemaakt.
> Wordt opgezet zodra de eerste feature-bouw begint.

---

## Projectstructuur (zoals nu opgezet)

```
veiling-pro/
├── data/
│   ├── README.md
│   └── aloga-2026-import.json    24 loten Aloga Auction 2026
├── reports/                      Audit-rapporten per sessie
│   ├── 2026-04-29_initial-setup.md
│   └── 2026-05-02_*.md           Sessies van 2 mei
├── scripts/
│   ├── import-lots.mjs           Generiek import-script (per JSON)
│   ├── aloga-2026-enrich.py      Eenmalige enrichment van 17 lots via
│   │                              WebFetch (data ingelezen op 30-04)
│   ├── import-pedigree.mjs       Importeert pedigrees in lots.pedigree
│   │                              uit data/aloga-2026-pedigree.json
│   └── reset-auction.sql         Reset hamer-data + active_lot_id voor
│                                  één veiling. Sectie 4 wist optioneel
│                                  ook test-klanten van het huis.
├── src/
│   ├── components/
│   │   ├── NoteField.jsx              Auto-save textarea (debounce 800ms)
│   │   ├── AutoSaveNumber.jsx         Auto-save number-input + optionele
│   │   │                               duizendscheiding (displayWithThousands)
│   │   │                               + presets (datalist)
│   │   ├── AutoSaveUrl.jsx            Auto-save URL-input + 🔗 open-link,
│   │   │                               compact-modus voor inline gebruik
│   │   ├── EditableLongText.jsx       Lange tekst met read-only weergave +
│   │   │                               ✏-bewerk-knop (auto-save)
│   │   ├── Modal.jsx                  Generieke modal-overlay (Esc, click-out)
│   │   ├── LotTypesSelector.jsx       Checkbox-grid op AuctionPage (default
│   │   │                               ingeklapt)
│   │   ├── BidStepRulesEditor.jsx     Mini-tabel-editor (Van € … tot € … stap €)
│   │   │                               met datalist-presets
│   │   ├── BidStepRulesPreview.jsx    Read-only weergave per lot-type
│   │   ├── LotTypeDropdown.jsx        Type-keuze per lot
│   │   ├── CockpitStatusBar.jsx       Live X/N · ✓/⊘ · omzet · ⌀ · einde
│   │   ├── PedigreeTree.jsx           Bracket-tree (3 generaties)
│   │   ├── InterestedClientsField.jsx Klanten-sectie op LotPage met
│   │   │                               autocomplete + auto-fill seating +
│   │   │                               ✏-bewerk per rij
│   │   ├── BuyerAutocomplete.jsx      Koper-input in cockpit hamer-form
│   │   ├── SpottersField.jsx          AuctionPage-sectie met slot-dropdown
│   │   │                               + autocomplete uit globale spotters
│   │   └── SpottersStrip.jsx          Compacte cockpit-strip 👥
│   ├── lib/
│   │   ├── supabase.js           Supabase client
│   │   ├── missingInfo.js        Vertaling + helpers voor missing_info
│   │   ├── bidSteps.js           nextBidStep / sortByRangeFrom helpers
│   │   ├── clients.js            Klanten-helpers (zoek, create, seating,
│   │   │                          koppeling, aankoop-aggregatie)
│   │   ├── spotters.js           Spotter-helpers (globaal + junction)
│   │   ├── breaks.js             Pauze-helpers (collection_breaks, per dag)
│   │   └── collectionDays.js     Veilingdag-helpers (collection_days, 0031)
│   ├── pages/
│   │   ├── HousesPage.jsx           / — lijst van veilinghuizen
│   │   ├── HousePage.jsx            /houses/:id — veilingen voor een huis
│   │   ├── AuctionPage.jsx          /auctions/:id — 24 lots + types/staffels
│   │   ├── AuctionSummaryPage.jsx   /auctions/:id/summary — overzicht einde
│   │   ├── LotPage.jsx              /lots/:id — volledig paard-detail
│   │   └── CockpitPage.jsx          /cockpit/:auctionId — live veiling-cockpit
│   ├── App.jsx                   Router-shell (Routes, header met logo)
│   ├── index.css
│   └── main.jsx                  Entry point — wraps App in BrowserRouter
├── supabase/
│   └── migrations/               PostgreSQL schema (0001 t/m 0007)
├── .env.example                  Template (in git)
├── .env.local                    Lokale waarden (NIET in git)
├── .gitignore
├── DEVELOPER_SETUP.md            Dit document
├── HANDOVER.md                   Sessie-overdracht-notities
├── MASTER_PROMPT.md              Werkwijze en profiel
├── PROJECT_STATUS.md             Huidige stand van het project
├── README.md
├── index.html
├── package.json
├── package-lock.json
├── vercel.json                   SPA-fallback rewrites voor Vercel
└── vite.config.js
```

---

## Build-check vóór elke commit

```bash
npm run build
```

Moet slagen zonder errors. Nooit committen bij een falende build.

---

## Rollback

```bash
git log --oneline       # bekijk recente commits
git revert [hash]       # draai een specifieke commit terug
```

Of via Vercel dashboard → Deployments → vorige deployment activeren.

---

## Live dashboard (deelbare link)

De live pagina voor de organisatie is bereikbaar via:
```
https://[jouw-vercel-url]/live/aloga-2026
```

Geen login vereist voor deze pagina — read-only, enkel kijken.

---

## Offline werking (cockpit)

De live cockpit is gebouwd als PWA. Bij geen internetverbinding:
- Wijzigingen worden lokaal opgeslagen
- Zodra verbinding hersteld: automatisch gesynchroniseerd naar Supabase

---

## Notities

- Supabase free tier: 500MB database, 1GB storage — ruim voldoende
- Vercel free tier: onbeperkte deployments — ruim voldoende
- Alle data blijft in eigen beheer, geen afhankelijkheid van externe platforms
