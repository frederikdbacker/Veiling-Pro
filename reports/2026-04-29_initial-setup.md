# Sessieaudit — initiële setup Veiling-Pro

**Datum:** 29 april 2026
**Machine:** Mac mini van Conceptosaurus
**Sessietype:** Code (Claude Code in `~/veiling-pro/`)
**Duur:** ~1 uur (één doorlopende sessie)
**Eindtijd:** zie git log van vandaag

---

## Wat is er gebeurd?

In één sessie is het Veiling-Pro-project van 0 naar "scaffold-klaar" gebracht:

1. **Lege projectmap** `~/veiling-pro/` opgezet als zelfstandige Git-repo (eerst per
   ongeluk in `~/fei-system/veiling-pro/`, daarna verhuisd zodra dat duidelijk werd).
2. **Vite + React 18** geïnstalleerd, samen met `@supabase/supabase-js`.
3. **Supabase-client** bedraad via `src/lib/supabase.js`, leest URL en publishable
   key uit `.env.local`. De smoke-test op de homepage toont het aantal `auction_houses`
   uit de database — als dat lukt, weet je meteen dat de verbinding werkt.
4. **SQL-migratie** geschreven in `supabase/migrations/0001_init.sql` met drie
   tabellen: `auction_houses`, `auctions`, `lots`. Schema is uitgebreid op basis
   van wat de Aloga-import-JSON daadwerkelijk bevat (foto's, catalogustekst,
   EquiRatings-tekst, USP, sterke/zwakke punten, biedstappen, koperland,
   data-betrouwbaarheid, ontbrekende-info-checklist).
5. **Generiek import-script** geschreven (`scripts/import-lots.mjs`) dat elke
   JSON in dezelfde vorm als `aloga-2026-import.json` kan inlezen, een veilinghuis
   en veiling automatisch aanmaakt, en alle loten invoegt. Werkt voor toekomstige
   veilingen zonder code-aanpassing.
6. **JSON-data** (24 loten Aloga 2026) gekopieerd naar `data/aloga-2026-import.json`.
7. **Documenten geüpdatet**: PROJECT_STATUS.md, MASTER_PROMPT.md en
   DEVELOPER_SETUP.md zijn alle drie bijgewerkt naar 29 april 2026 zoals
   voorgeschreven door regel 4 van het master prompt ("drie documenten als één set").
8. **GitHub-koppeling**: alles is gepusht naar `github.com/frederikdbacker/Veiling-Pro`,
   branch `main`.

---

## Wat zou er fout kunnen gaan?

### 1. SQL-migratie heeft een conflict bij Run
**Risico:** als er al tabellen met dezelfde namen in Supabase staan, faalt de migratie.
**Detectie:** rode foutmelding in de SQL Editor.
**Oplossing:** als je de tabellen wilt resetten, eerst `drop table lots, auctions, auction_houses cascade;` runnen, daarna de migratie opnieuw.

### 2. Import-script faalt op missing column
**Risico:** als 0001_init.sql niet (of niet volledig) is gedraaid, gooit het script
errors als "column 'photos' does not exist".
**Detectie:** rode foutmelding in de terminal, geen lots ingevoegd.
**Oplossing:** controleer in Supabase Table Editor of alle drie de tabellen er staan
en alle kolommen aanwezig zijn. Anders 0001_init.sql opnieuw runnen.

### 3. Publishable key in `.env.local` past niet bij RLS
**Risico:** RLS staat aan met "anon read/write"-policies; dat zou moeten werken met
elke geldige client-key. Mocht je later auth toevoegen of een nieuwe key genereren,
dan kan import falen op `permission denied`.
**Detectie:** Supabase-foutmelding "new row violates row-level security policy".
**Oplossing:** key in `.env.local` updaten en `node --env-file=.env.local ...`
opnieuw draaien.

### 4. Verschillen tussen "Aloga" als naam en gedrag van het script
**Risico:** het script leidt het veilinghuis af uit het eerste woord van
`meta.auction` (`"Aloga Auction 2026"` → `"Aloga"`). Als een toekomstige JSON
bijvoorbeeld `"Stoeterij Zangersheide Auction 2026"` heeft, krijg je
`"Stoeterij"` als huisnaam. Dat is dan fout.
**Detectie:** verkeerde naam in de `auction_houses`-tabel na import.
**Oplossing:** voor zulke gevallen het import-script lichtjes aanpassen, óf de naam
handmatig in de database wijzigen.

### 5. Vercel-deployment is nog niet getest
**Risico:** lokale build slaagt, maar Vercel kan op een andere Node-versie of
ontbrekende env vars stuklopen.
**Detectie:** rode build-status in Vercel-dashboard zodra je gaat deployen.
**Oplossing:** dat lossen we op zodra we daar aan toe zijn (planning: Dag 1).

---

## Wat moet visueel gecontroleerd worden?

In volgorde:

1. **Op Supabase Dashboard** (https://supabase.com/dashboard/project/cjxtwzmryrpwoydrqqil):
   - Ga naar **SQL Editor** → **New query** → plak inhoud van
     `supabase/migrations/0001_init.sql` → klik **Run**.
   - Open daarna **Table Editor** in het zij-menu. Je moet daar drie tabellen zien staan:
     `auction_houses`, `auctions`, `lots`. Alle drie nog leeg.

2. **In de terminal** (`~/veiling-pro/`):
   ```
   node --env-file=.env.local scripts/import-lots.mjs data/aloga-2026-import.json
   ```
   Verwachte output: `📦 Aloga Auction 2026: 24 paarden`, gevolgd door huis-id,
   auction-id, en `✅ 24 lots ingevoegd` met genummerde lijst.

3. **Terug in Supabase Table Editor**: refresh `lots` — er moeten 24 rijen staan.
   Open er één om te kijken of `catalog_text` en `photos` ingevuld zijn.

4. **In de browser** (`npm run dev` → http://localhost:5173):
   - Verwacht: titel "Veiling Pro" en de tekst
     **"Verbonden met Supabase — 1 veilinghuizen gevonden"** met "Aloga" eronder.
   - Als er staat *"0 veilinghuizen"*: dan is de migratie wél, maar de import
     niet gelukt.
   - Als er staat *"Fout bij ophalen: ..."*: dan klopt iets met de Supabase-key.

---

## Hoe rollback?

### Code rollback
Beide commits staan op GitHub, lokaal en remote:

| Commit | Inhoud |
|---|---|
| `a6e4ea7` | initial Vite + React + Supabase scaffold |
| `35a43f9` | docs: MASTER_PROMPT, PROJECT_STATUS en DEVELOPER_SETUP toegevoegd |
| (nieuw) | feat: extend lots schema en import-pipeline |
| (nieuw) | docs: prompts geüpdatet en sessieaudit toegevoegd |

Een specifieke commit ongedaan maken:
```
git revert <hash>
git push
```

### Database rollback
Als de migratie of import iets stuk maakt: in Supabase SQL Editor draaien:
```sql
drop table if exists lots cascade;
drop table if exists auctions cascade;
drop table if exists auction_houses cascade;
```
Daarna eventueel 0001_init.sql opnieuw runnen.

> **Belangrijk:** dit verwijdert ALLE data in deze tabellen. Op dit moment is dat OK
> (alleen de Aloga-import staat erin), maar zodra je live bent, eerst een
> Supabase-backup maken.

---

## Volgende stap

> **Voor jou (handmatig):**
> 1. SQL plakken in Supabase Dashboard → SQL Editor → Run
> 2. `node --env-file=.env.local scripts/import-lots.mjs data/aloga-2026-import.json`
> 3. `npm run dev` → http://localhost:5173 — moet 1 veilinghuis tonen
> 4. Bevestigen aan Claude dat dit gelukt is, dan beginnen we aan de
>    voorbereidingsmodule (Dag 2-3 in PROJECT_STATUS.md).
