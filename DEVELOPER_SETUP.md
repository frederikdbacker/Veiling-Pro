# DEVELOPER_SETUP — Veiling-Pro

**Laatste update: 2 mei 2026 (sessie-einde)**

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
3. Verifieer in Table Editor dat alle tabellen bestaan:
   - `auction_houses`, `auctions`, `lots`
   - `lot_types`, `auction_lot_types`, `bid_step_rules`
   - `clients`, `lot_interested_clients`, `client_auction_seating`
   - `spotters`, `auction_spotters`

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
│   │   └── spotters.js           Spotter-helpers (globaal + junction)
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
