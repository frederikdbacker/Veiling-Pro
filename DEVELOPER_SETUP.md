# DEVELOPER_SETUP — Veiling-Pro

**Laatste update: 30 april 2026 (sessie-einde)**

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
2. Plak de inhoud van `supabase/migrations/0001_init.sql`
3. Klik Run
4. Verifieer in Table Editor dat `auction_houses`, `auctions` en `lots` bestaan

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

```bash
npm install -g vercel
vercel
```

Vercel koppelt automatisch aan de GitHub repo. Elke `git push` naar `main`
triggert automatisch een nieuwe deployment.

### Environment variables in Vercel

Voeg toe via Vercel dashboard → Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

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
│   └── 2026-04-29_initial-setup.md
├── scripts/
│   ├── import-lots.mjs           Generiek import-script (per JSON)
│   └── aloga-2026-enrich.py      Eenmalige enrichment van 17 lots via
│                                  WebFetch (data ingelezen op 30-04)
├── src/
│   ├── components/
│   │   ├── NoteField.jsx         Auto-save textarea (debounce 800ms)
│   │   ├── AutoSaveNumber.jsx    Auto-save number-input (idem)
│   │   ├── AutoSaveUrl.jsx       Auto-save URL-input + 🔗 open-link
│   │   ├── LotTypesSelector.jsx  Checkbox-grid op AuctionPage
│   │   ├── BidStepRulesEditor.jsx Mini-tabel-editor (Van € … tot € … stap €)
│   │   ├── BidStepRulesPreview.jsx Read-only weergave per lot-type
│   │   └── LotTypeDropdown.jsx   Type-keuze per lot
│   ├── lib/
│   │   ├── supabase.js           Supabase client
│   │   ├── missingInfo.js        Vertaling + helpers voor missing_info
│   │   └── bidSteps.js           nextBidStep / sortByRangeFrom helpers
│   ├── pages/
│   │   ├── HousesPage.jsx        / — lijst van veilinghuizen
│   │   ├── HousePage.jsx         /houses/:id — veilingen voor een huis
│   │   ├── AuctionPage.jsx       /auctions/:id — 24 lots + types/staffels
│   │   ├── LotPage.jsx           /lots/:id — volledig paard-detail
│   │   └── CockpitPage.jsx       /cockpit/:auctionId — live veiling-cockpit
│   ├── App.jsx                   Router-shell (Routes, header met logo)
│   ├── index.css
│   └── main.jsx                  Entry point — wraps App in BrowserRouter
├── supabase/
│   └── migrations/
│       └── 0001_init.sql         PostgreSQL schema
├── .env.example                  Template (in git)
├── .env.local                    Lokale waarden (NIET in git)
├── .gitignore
├── DEVELOPER_SETUP.md            Dit document
├── MASTER_PROMPT.md              Werkwijze en profiel
├── PROJECT_STATUS.md             Huidige stand van het project
├── README.md
├── index.html
├── package.json
├── package-lock.json
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
