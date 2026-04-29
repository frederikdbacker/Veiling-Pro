# DEVELOPER_SETUP — Veiling-Pro

**Laatste update: april 2026**

---

## Vereisten

- Node.js 18 of hoger
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
git clone https://github.com/frederikdbacker/Veiling-Pro.git
cd veiling-pro
npm install
```

---

## Omgevingsvariabelen

Maak een `.env` bestand aan in de root van het project:

```
VITE_SUPABASE_URL=https://cjxtwzmryrpwoydrqqil.supabase.co
VITE_SUPABASE_ANON_KEY=[jouw anon key]
```

De anon key vind je in:
**Supabase dashboard → Project Settings → API → anon public**

⚠️ Zorg dat `.env` in `.gitignore` staat. Nooit committen met echte waarden.

---

## Supabase

- **Project URL:** https://cjxtwzmryrpwoydrqqil.supabase.co
- **Project ID:** cjxtwzmryrpwoydrqqil
- **Regio:** Frankfurt (eu-central-1)

### Schema aanmaken (eenmalig)

1. Ga naar supabase.com → jouw project → SQL Editor
2. Klik New Query
3. Plak de inhoud van `db/schema.sql`
4. Klik Run

### Data importeren (eenmalig)

```bash
node scripts/aloga-import.js
```

Of via Claude Code: "Importeer de data uit aloga-2026-import.json in de lots-tabel."

---

## Development server starten

```bash
npm run dev
```

De app opent op http://localhost:5173

---

## Vercel deployment

```bash
npm install -g vercel
vercel
```

Vercel koppelt automatisch aan de GitHub repo. Elke `git push` naar `main` triggert automatisch een nieuwe deployment.

### Environment variables in Vercel

Voeg toe via Vercel dashboard → Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

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

---

## Projectstructuur

```
veiling-pro/
├── .claude/
│   └── agents/              Sub-agent definities
├── db/
│   └── schema.sql           PostgreSQL schema voor Supabase
├── scripts/
│   └── aloga-import.js      Import script voor Aloga 2026 data
├── data/
│   └── aloga-2026-import.json  24 loten Aloga Auction 2026
├── src/
│   ├── components/          React componenten
│   ├── pages/               Pagina's (voorbereiding, cockpit, live)
│   ├── lib/
│   │   └── supabase.js      Supabase client
│   └── main.jsx             Entry point
├── .env                     Lokale omgevingsvariabelen (niet committen)
├── .gitignore
├── MASTER_PROMPT.md         Werkwijze en profiel
├── PROJECT_STATUS.md        Huidige stand van het project
├── DEVELOPER_SETUP.md       Dit document
└── package.json
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
