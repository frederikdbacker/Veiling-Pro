# Audit-rapport — Meerdaagse veilingen (dag-opsplitsing)

**Datum:** 23 juni 2026
**Branch:** `feat/meerdaagse-veilingdagen` (nog niet gepusht, geen PR)
**Plan:** `docs/plan-meerdaagse-collectie-opsplitsing.md`
**Build:** `npm run build` ✓ groen na elke fase

---

## Wat is er gebouwd (in gewone taal)

Een collectie (een hele verkoop, zoals "Deauville Sélection") kan nu over
**meerdere veilingdagen** lopen. Tot nu toe ging het systeem ervan uit dat
elke verkoop op één avond gebeurt. Vanaf nu:

- Je kunt per collectie **veilingdagen** aanmaken (bv. dag 1 = maandag 29 juni,
  dag 2 = dinsdag 30 juni).
- Je verdeelt de paarden over die dagen — via een **keuzelijstje per paard**,
  door ze te **slepen** naar een dag, met **vinkjes + "verplaats naar dag X"**,
  of met de snelle helper **"lots #1–#38 → dag 1"**.
- De **cockpit** draait per veilingdag: bovenaan kies je de dag, en alles
  (welk lot in de piste staat, het verwachte einduur, de cijfers) geldt voor
  díé avond. De spotters (biedstaffel-mensen in de zaal) blijven hetzelfde
  over alle dagen, want dat is in de praktijk ook zo.
- **Pauzes** horen voortaan bij een specifieke dag.
- Het **eindoverzicht** toont een blok per dag plus een totaal over de hele
  verkoop. Het **huisoverzicht** toont een meerdaagse verkoop als datumreeks
  ("29 – 30 juni 2026") met het aantal dagen.

**Belangrijk: alles wat nu bestaat, blijft exact werken.** Elke bestaande
verkoop krijgt automatisch precies één veilingdag. Een eendaagse verkoop ziet
er overal hetzelfde uit als vroeger — de cockpit, de lotlijst en het overzicht
veranderen niet zichtbaar. De dag-functies verschijnen pas zodra je een
tweede dag toevoegt.

---

## Welke bestanden zijn gewijzigd

**Database-migraties (nieuw, nog NIET uitgevoerd):**
- `supabase/migrations/0031_collection_days.sql` — nieuwe tabel
  `collection_days`, kolom `lots.collection_day_id`, en de automatische
  invulling (één dag per bestaande collectie, alle lots eraan gekoppeld).
- `supabase/migrations/0032_breaks_per_day.sql` — pauzes krijgen een
  dag-koppeling; bestaande pauzes gaan naar dag 1.

**Frontend:**
- `src/lib/collectionDays.js` *(nieuw)* — alle databasebewerkingen voor dagen.
- `src/lib/breaks.js` — pauzes dragen nu een dag mee.
- `src/pages/CollectionPage.jsx` — sectie "Veilingdagen", dag-gegroepeerde
  lotlijst, herverdelen (dropdown/slepen/bulk/bereik), pauze-per-dag.
- `src/pages/CockpitPage.jsx` — dag-kiezer, sessie per dag, dag afsluiten.
- `src/pages/CollectionSummaryPage.jsx` — per-dag blok + totaal.
- `src/pages/HousePage.jsx` — datumreeks bij meerdaagse verkoop.
- `src/App.jsx` — extra cockpit-route met dag (`/cockpit/:id/:dayId`).

**Import-/scrape-scripts:**
- `scripts/lib/days.mjs` *(nieuw)* — gedeelde dag-helpers.
- `scripts/import-fences-calendrier.mjs` — meerdaagse verkopen krijgen meteen
  hun dagen (Deauville Sélection = 2, Élite = 4).
- `scripts/import-lots.mjs`, `scripts/import-fences-catalogus.mjs` — koppelen
  elk paard aan een dag.
- `scripts/scrape-fences-ordre-passage.mjs` *(nieuw)* — verdeelt lots over
  dagen op basis van de doorkomstvolgorde, met audit van verschuivingen.

---

## Om dit live op de website te zien (stappen voor Frederik)

1. **Maak eerst een Supabase-backup** (projectregel — verplicht vóór een
   schemawijziging).
2. **Voer de twee migraties uit** in de Supabase SQL Editor, in volgorde:
   eerst `0031_collection_days.sql`, dan `0032_breaks_per_day.sql`. Elk bestand
   bevat onderaan een controle-query (verwacht: 0 rijen / elke collectie 1 dag).
3. **Pas daarna pas de code toe** (deze branch mergen en Vercel laten
   deployen). De volgorde is bewust: migratie eerst, code daarna.
4. Wil je geen migratie draaien? Dan blijft de site werken in "legacy-modus":
   zonder de tabel valt de cockpit terug op het oude collectie-brede gedrag.

> De code en de migraties staan nu samen op de feature-branch. Er is **niet
> gepusht** en er is **geen PR** geopend — dat doe ik pas op jouw vraag.

---

## Wat kan er misgaan / aandachtspunten (visueel te controleren)

- **Eendaagse verkoop = ongewijzigd?** Open een bestaande verkoop en de
  cockpit: lotlijst, volgorde, hameren en het overzicht moeten er identiek
  uitzien als vroeger. (Dit is de belangrijkste regressie-check.)
- **Nieuw lot tijdens meerdaags:** een handmatig toegevoegd lot landt in
  "Niet toegewezen" tot je het een dag geeft. Bij een eendaagse verkoop gaat
  het automatisch naar dag 1.
- **Lots verdwijnen nooit:** een lot zonder dag blijft zichtbaar op de
  collectie-pagina (in de groep "Niet toegewezen"), maar verschijnt niet in
  de cockpit van een dag tot het toegewezen is.
- **Dag verwijderen** kan alleen als de dag leeg is (anders eerst herverdelen).
- **Slepen op iPad:** de keuzelijst per lot is het betrouwbaarste alternatief
  als slepen op touch niet vlot gaat — bewust ingebouwd.

## Hoe terugdraaien

- **Code:** `git revert` van de betrokken commits, of in Vercel een vorige
  deployment activeren.
- **Database:** de migraties zijn puur additief (geen kolom wordt verwijderd
  of hernoemd). Terugdraaien kan met `drop table collection_days cascade;` en
  `alter table collection_breaks drop column collection_day_id;` — maar dat is
  alleen nodig als je écht terug wil; de oude code negeert de nieuwe kolommen.

---

## Resterende beslispunten / open punten

- **Ordre de passage (doorkomstvolgorde):** de Fences-pagina gaf nog HTTP 500
  (nog niet gepubliceerd). Tot ze online staat is handmatig verdelen de basis;
  het script `scrape-fences-ordre-passage.mjs` neemt de verdeling later over
  zodra de gegevens er zijn (`--probe <url>` checkt of de pagina al leeft).
- **Opruiming later:** de oude kolommen `collections.active_lot_id`,
  `time_auction_start/end` blijven (gedeprecieerd) bestaan; droppen pas in een
  latere migratie zodra alles bewezen op dagen draait (conform de bestaande
  0030-discipline).
- **Geen testsuite/lint in dit project:** de deterministische controle is
  `npm run build` (groen). Visuele tests doe jij als finale review-instantie.
