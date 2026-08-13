# Audit-rapport — Centrale login (Supabase Auth) aangesloten

**Datum:** 2 juli 2026
**Branch:** `feat/centrale-login` (nog niet gecommit/gepusht — Frederik doet dat na visuele controle)
**Thema:** de app achter de centrale login + rolcontrole zetten

---

## In gewone taal — wat is er gebeurd?

De app krijgt nu een **inlogscherm**. Wie de app opent en niet is ingelogd, ziet
eerst een scherm met e-mail + wachtwoord. Na inloggen controleert de app in het
**centrale login-systeem** of dit account toegang heeft tot "Veiling Pro". Zo ja
→ de gewone app verschijnt, met rechtsboven het e-mailadres, de rol en een
**Uitloggen**-knop. Zo nee → een nette melding "geen toegang" met een uitlogknop.

Belangrijk om te weten: de login en de veilingdata leven in **twee aparte
Supabase-projecten**. De login (+ wie welke rol heeft) zit in het centrale
project; alle veilingdata blijft in het bestaande data-project. De app praat nu
met allebei tegelijk, via twee gescheiden verbindingen.

---

## Wat is er precies gebouwd (bestanden)

| Bestand | Rol |
|---|---|
| `src/lib/centralAuth.js` | Aparte verbinding naar het centrale login-project. Eigen env-vars + eigen `storageKey` zodat de data-verbinding ongemoeid blijft. |
| `src/lib/AuthContext.jsx` | Bewaakt de inlogstatus + de rol. Haalt bij opstart de sessie op, luistert op login/logout, leest de rol uit `user_roles` (project = `veiling_pro`, `maybeSingle`, **zonder** `user_id`-filter — RLS toont alleen de eigen rij). |
| `src/components/LoginScreen.jsx` | E-mail + wachtwoord via `signInWithPassword`. Geen registratie, geen wachtwoord-reset. Generieke foutmelding. |
| `src/components/AuthGate.jsx` | De poort: `laden → inloggen → geen-toegang → app`. |
| `src/components/AccountBar.jsx` | Discrete balk rechtsboven: e-mail · rol · Uitloggen. |
| `src/main.jsx` | Poort om de hele app gehangen (`AuthProvider` → `AuthGate` → app). |
| `.env.example` | Twee nieuwe regels voor de centrale login. |

---

## Bewust afgeweken van de opdracht (met reden)

1. **Env-var-namen.** De opdracht noemde `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY`, maar `VITE_SUPABASE_URL` was al in gebruik voor het
   data-project. Nieuwe, gescheiden namen: **`VITE_CENTRAL_AUTH_URL`** +
   **`VITE_CENTRAL_AUTH_ANON_KEY`**. (Door de adviseur goedgekeurd.)
2. **`.gitignore`.** Niet `.env*` als blanket-regel toegevoegd — dat zou
   `.env.example` (die we juist wél tracken) uitsluiten. De bestaande regels
   (`.env`, `.env.local`, `.env.*.local`) dekken het geheime bestand correct.

---

## Getest (live, op `npm run dev`)

- ✅ Niet ingelogd → **inlogscherm** verschijnt (geen crash, app niet zichtbaar).
- ✅ Verkeerd wachtwoord → nette foutmelding (bewijst de echte round-trip naar
  het centrale project).
- ✅ Correcte login (`frederik@conceptosaurus.eu`) → app verschijnt, rol
  **admin** correct opgehaald en getoond, veilinghuizen laden gewoon (data-project
  intact naast de login).
- ✅ `npm run build` slaagt zonder fouten.

**Nog niet geklikt (aan Frederik):** de Uitloggen-knop (om niet opnieuw te
moeten inloggen). De werking is triviaal: uitloggen → terug naar inlogscherm.

**Visueel te controleren:** de balk rechtsboven mag op de brede **cockpit** geen
bestaande knoppen overlappen.

---

## ⚠️ Beveiligingsgrens — open taak met prioriteit HOOG

De login-poort bepaalt **wie het scherm ziet**, maar beschermt de data zelf
**niet**. De veilingdata staat in het data-project met **volledig open
toegangsregels** (`using (true)` op zowel lezen als schrijven). Iedereen die de
publieke sleutel van de app kent (die zit onvermijdelijk in de app-code) kan de
data rechtstreeks lezen én **schrijven**, zonder in te loggen. Vooral het
open-schrijfrisico is niet houdbaar.

Besluit (adviseur): in deze klus **niets aan de policies van het data-project
gewijzigd**. Het echt vergrendelen wordt een apart vervolgtraject.

### Vliegende start voor het vervolgtraject — tabel-inventaris (data-project)

Tabellen die de frontend aanspreekt (aantal `.from()`-verwijzingen in `src/`;
allemaal nu `using (true)`):

| Tabel | # refs | | Tabel | # refs |
|---|---|---|---|---|
| `lots` | 45 | | `clients` | 7 |
| `collections` | 19 | | `bid_step_rules` | 7 |
| `collection_spotters` | 16 | | `auction_houses` | 7 |
| `collection_days` | 8 | | `collection_breaks` | 6 |
| `lot_interested_clients` | 7 | | `client_collection_seating` | 6 |
| `collection_lot_types` | 7 | | `spotters` | 4 |
| `scrape_jobs` | 4 | | `house_committee_members` | 4 |
| `lot_types` | 3 | | `lot_sale_corrections` | 2 |
| `worker_heartbeat` | 1 | | | |

`user_roles` hoort **niet** in deze lijst: die query gaat naar het **centrale**
project via de aparte auth-client.

**Aandachtspunt voor het vervolg:** het data-project (`cjxtwzmryrpwoydrqqil`) en
het centrale login-project (`igunbmpreaqrlyqnxeud`) zijn losse projecten met
losse JWT-geheimen. Een sessie/token uit het centrale project authenticeert
**niet** automatisch tegen het data-project. Vergrendelen vraagt dus een keuze:
(a) het data-project onder dezelfde centrale login brengen, of (b) een kleine
tussenlaag (edge function / API) die het centrale token verifieert vóór data
teruggaat. Naast schrijven ook de worker/scripts meenemen (die gebruiken de
service-role- of publishable key serverside).

---

## Wat moet in Vercel (project "veiling-pro")

Twee nieuwe environment variables toevoegen (waarden zijn publiek bedoeld):

- `VITE_CENTRAL_AUTH_URL` = `https://igunbmpreaqrlyqnxeud.supabase.co`
- `VITE_CENTRAL_AUTH_ANON_KEY` = *(anon-sleutel centrale project)*

De bestaande `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` blijven staan.
Zonder de twee nieuwe vars start de app bewust niet (duidelijke foutmelding).

---

## Rollback

Alles zit op de branch `feat/centrale-login`. Terug naar de vorige toestand:
`git checkout main` (branch niet gemerged) — of, indien later gemerged, de
merge-commit reverten. Er zijn **geen** schemawijzigingen en **geen**
data-mutaties gedaan.
