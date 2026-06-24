# Audit-rapport — "Collectie ophalen" via een geplakte link (URL-ingest)

**Datum:** 24 juni 2026
**Branch:** `feat/plak-collectielink-ingest` (nog niet gepusht, geen PR)
**Plan:** `docs/plan-plak-collectielink-ingest.md`
**Build:** `npm run build` ✓ groen · registry-test ✓ · worker boot-test ✓

---

## 1. Wat is er gebouwd (in gewone taal)

Je kan nu binnen een veilinghuis een **link naar een online collectie plakken** en
op **"Collectie ophalen"** klikken. Het systeem kiest automatisch de juiste
scraper voor die website, haalt de catalogus op en zet de paarden in een nieuwe
collectie — en je ziet live of het lukt (in wachtrij → bezig → klaar / mislukt).

Omdat de website van Veiling Pro zelf geen scraper kan draaien, gebeurt het
échte ophalen door een klein **achtergrondprogramma (de "worker")** dat op je
**Mac mini** draait. De website schrijft enkel een "opdracht-rij" in de database;
de worker pikt die op, draait precies dezelfde scripts die je nu met de hand
draait, en schrijft de status terug. Jij ziet dat live op het scherm.

### Twee plekken in de UI
- **Op een veilinghuis-pagina** → knop **"🔗 Collectie ophalen"** (nieuwe
  collectie). Daaronder verschijnt een lijstje **"Recente imports"** met de
  status van de laatste ophaal-acties.
- **Op een collectie-pagina** → knop **"🔗 Catalogus ophalen"** in het
  Acties-menu (vult een *bestaande* collectie, of haalt opnieuw op).

### Statusteksten (zoals afgesproken)
In wachtrij → Bezig met ophalen → Klaar / Mislukt, met een nette foutmelding in
mensentaal en een knop **"Opnieuw proberen"** als het misging.

---

## 2. Welke bestanden zijn nieuw / gewijzigd

**Nieuwe migraties (NOG NIET toegepast — jij draait ze, zie §4):**
- `supabase/migrations/0033_collection_source_url.sql` — onthoudt vanwáár een
  collectie is opgehaald (kolom `collections.source_url`).
- `supabase/migrations/0034_scrape_jobs.sql` — de wachtrij-/audit-tabel
  `scrape_jobs` + realtime.

> ⚠️ **Belangrijke afwijking van het plan:** het plan noemde migratie-nummers
> 0031/0032, maar die zijn intussen door de *meerdaagse-veilingen*-feature
> gebruikt. De nieuwe nummers zijn daarom **0033 en 0034**. Inhoud ongewijzigd.

**Nieuwe code:**
- `src/lib/scraperRegistry.js` — één gedeelde lijst "welke site → welke scraper".
  Gebruikt door zowel de website (live-controle van de link) als de worker.
- `src/lib/scrapeJobs.js` — database-helpers + live-status (realtime, met
  polling als terugval).
- `src/components/CollectionIngestModal.jsx` — het venster waarin je de link
  plakt en de status ziet.
- `src/components/ScrapeJobStatus.jsx` — de status-weergave (balk, ✓/✗, details).
- `bin/scrape-worker.mjs` — de worker (achtergrondprogramma op de Mac mini).
- `bin/eu.conceptosaurus.veilingpro.worker.plist.example` — voorbeeld zodat de
  worker na herstart van de mini vanzelf opstart (LaunchAgent).
- `scripts/test-scraper-registry.mjs` — zelftest van de registry.

**Gewijzigd (klein, additief):**
- `src/pages/HousePage.jsx` — knop + modal + "Recente imports".
- `src/pages/CollectionPage.jsx` — knop in het Acties-menu + modal (**enkel
  toegevoegd**, niets verwijderd; zie §6).
- `package.json` — `npm run worker` en `npm run test:registry`.
- `src/index.css` — kleine animatie voor de voortgangsbalk.

**De bestaande scrapers/importers zijn NIET aangeraakt** — de worker roept ze
ongewijzigd aan, exact zoals jij dat nu handmatig doet.

---

## 3. Hoe de worker op de Mac mini gestart wordt

Op de mini, in de projectmap:

```bash
cd ~/veiling-pro
npm run worker
```

Hij blijft draaien en wacht op opdrachten. Stoppen: Ctrl-C.

**Automatisch meedraaien na herstart** (aanrader voor de altijd-aan mini): volg
de instructie boven in `bin/eu.conceptosaurus.veilingpro.worker.plist.example`
(paden aanpassen → kopiëren naar `~/Library/LaunchAgents/` → `launchctl load`).

De worker gebruikt de sleutels uit `.env.local` (staat niet in git). Optioneel
voeg je daar een `SUPABASE_SERVICE_ROLE_KEY` toe — netter voor een
serverside-achtig proces; anders valt hij terug op de publishable key.

---

## 4. Wat moet er nog gebeuren om dit live te krijgen

In deze volgorde:

1. **Supabase-backup** maken (projectregel vóór elke schemawijziging).
2. **Migratie 0033** draaien in de Supabase SQL Editor, daarna **0034**.
   (Beide zijn additief + idempotent — ze raken geen bestaande data.)
3. **Code deployen** (branch mergen → push → Vercel bouwt automatisch).
4. **Worker starten** op de Mac mini (`npm run worker`, of de LaunchAgent).
5. **Realtime checken:** migratie 0034 probeert `scrape_jobs` aan de
   realtime-publicatie toe te voegen. Staat realtime uit, dan valt de UI
   automatisch terug op pollen (elke 2s) — werkt nog steeds, iets minder snel.

Tot stap 2 gedaan is, toont de knop netjes een foutmelding ("tabel bestaat
niet") in plaats van te crashen — dat is getest.

---

## 5. Wat kan er misgaan / aandachtspunten

- **Worker draait niet** → jobs blijven op "In wachtrij" staan. De statusweergave
  hint dan dat de worker gestart moet worden. Oplossing: `npm run worker`.
- **Website zonder scraper** (bv. Hippomundo/Horse Telex achter Cloudflare) →
  de modal zegt "nog geen scraper"; je kan de link tóch bewaren (gaat niet
  verloren) en Claude Code voegt later een scraper + één registry-regel toe.
- **Fences** is bijzonder: de Fences-importer vult een *bestaande* collectie.
  Daarom werkt Fences via de knop **op de collectie-pagina** ("Catalogus
  ophalen"), niet via "nieuwe collectie ophalen". De modal legt dat uit.
- **Geen dubbele import:** de bestaande guard ("collectie heeft al lots → stop")
  blijft gelden. Fijnmazig opnieuw-samenvoegen op lot-niveau (handmatige
  velden behouden) is bewust een **latere fase** (plan I.5), nog niet gebouwd.
- **Audit-spoor:** elke poging is een aparte rij in `scrape_jobs`; "Opnieuw
  proberen" maakt een nieuwe rij, overschrijft nooit historie (CLAUDE.md §8).
- **Voortgangsbalk** is grof (fase + ruwe telling uit de scraper-logs); de
  scrapers zijn bewust niet aangepast. Een exactere balk vraagt een kleine
  toevoeging per scraper — later, indien gewenst.

## 6. Onverwacht voorval (gemeld, opgelost)

Tijdens de sessie bleek `src/pages/CollectionPage.jsx` halverwege **buiten mijn
edits om** gewijzigd te zijn: de `DayCountField`-component (de "aantal
veilingdagen"-dropdown uit de meerdaagse-feature) was eruit verdwenen. Bij
sessiestart was het bestand nog schoon. Ik heb het bestand **teruggezet naar de
laatste commit** en daarna **enkel mijn toevoegingen** opnieuw aangebracht. Het
diff is nu zuiver additief (16 regels bij, 0 weg); `DayCountField` is intact.
Geen regressie op de meerdaagse-feature.

---

## 7. Rollback

- Code: `git checkout main` (branch is nog niet gemerged) of de feature-branch
  laten staan zonder te deployen.
- Database: 0033/0034 zijn additief; verwijderen kan met
  `drop table scrape_jobs;` en `alter table collections drop column source_url;`
  (enkel nodig als je echt wil terugdraaien — niet vereist).
