# Veiling Pro

React-app voor het werk van een professionele veilingmeester op paardenveilingen.

## Stack
- Vite + React 18
- Supabase (database + auth)
- Vercel (deployment, later)

## Setup

```bash
npm install
cp .env.example .env.local   # vul Supabase URL + publishable key in
npm run dev
```

Open http://localhost:5173. De homepage toont een lijstje van `auction_houses` als smoke-test.

## Database

De SQL-migratie staat in `supabase/migrations/0001_init.sql`.

**Eerste keer**: open het Supabase Dashboard → SQL Editor → plak de inhoud → Run.

## Structuur

```
veiling-pro/
├── index.html
├── package.json
├── vite.config.js
├── .env.example          # template (in git)
├── .env.local            # echte keys (NIET in git)
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   └── lib/
│       └── supabase.js   # Supabase-client
└── supabase/
    └── migrations/
        └── 0001_init.sql
```
