# Audit-rapport — Spotters-uitbouw + cockpit-quickwins

**Datum:** 30 juni 2026
**Branches:** `feat/cockpit-quickwins` (A1+A2) en `feat/spotters-uitbouw` (B1+B2+B3)
**PR's:** #30 (A1+A2) en #31 (B1+B2+B3) — beide gemerged naar `main`
**Live:** https://veiling-pro.vercel.app (productie-deploy READY)

---

## 1. Wat is er gewijzigd (in gewone taal)

### A1 — Donkere koper-invoer in de cockpit
Het invoerveld voor de kopernaam en de suggestielijst stonden nog op een witte
achtergrond — de enige lichte plek in de donkere cockpit. Die lichte kleuren zijn
vervangen door de donkere themakleuren. Het veld, de suggestielijst en de
sterretjes-rij (geïnteresseerden) passen nu bij de rest.
*Bestand:* `src/components/BuyerAutocomplete.jsx`.

### A2 — Markering "geen startprijs" op de collectielijst
Op de lijst van loten zie je nu in één oogopslag welke paarden nog géén
startprijs hebben:
- per lot een rood label **"⚠ geen startprijs"**;
- bovenaan een klikbare balk **"X loten zonder startprijs"** die naar het eerste
  zo'n lot springt en het kort oplicht.
Dit is **enkel een signaal** — je kan nog gewoon hameren, niets wordt geblokkeerd.
Teruggetrokken loten tellen niet mee. *Bestand:* `src/pages/CollectionPage.jsx`.

### B1 — Spotterspool-pagina (`/spotters`)
Een nieuwe pagina met alle spotters als fotokaarten (bereikbaar via
"🧍 Spotterspool →" op de homepage). Je kan er foto's uploaden, namen bewerken,
zoeken, en filteren per veilinghuis. Dat huisfilter wordt **automatisch uit de
historie afgeleid**: een spotter "hoort bij" een huis zodra hij ooit aan een
veiling van dat huis was toegewezen (geen aparte tabel nodig). Je vinkt spotters
aan en voegt ze in één keer aan een gekozen veiling toe; al-toegewezen spotters
worden overgeslagen (geen dubbels). *Bestanden:* `src/pages/SpottersPage.jsx`
(nieuw), `src/lib/spotters.js`, `src/App.jsx`, `src/pages/HousesPage.jsx`.

### B2 — Spotters per veilingdag (meerdaagse veilingen)
Bij een veiling van meerdere dagen kan elke dag nu een andere spotter-bezetting
hebben. De spotters-sectie toont per dag een eigen lijst: toevoegen, ✕
(verwijder enkel van díe dag), ⧉ (zet iemand op alle dagen), en volgorde per dag.
"Verwijder van één dag" werkt ook als iemand nog op een oude "alle dagen"-rij
stond (dan waaiert dat automatisch uit naar de overige dagen). De cockpit laadt
de spotters van de **actieve dag**. Eendaagse veilingen blijven exact zoals
vroeger. *Database:* migratie **0038** (zie §4). *Bestanden:* `src/lib/spotters.js`,
`src/components/SpottersField.jsx`, `src/pages/CockpitPage.jsx`,
`src/pages/CollectionPage.jsx`.

### B3 — Spotter kiezen via de beginletter (cockpit)
Tijdens het veilen druk je de beginletter van een spotter om hem te selecteren.
Beginnen meerdere spotters met dezelfde letter, dan wissel je met herhaald
drukken tussen hen (ronddraaiend). De gekozen spotter licht meteen op. Werkt niet
terwijl je in een tekstveld typt. *Bestand:* `src/components/BidTracker.jsx`.

---

## 2. Wat zou er fout kunnen gaan (en hoe het is afgedekt)

- **B2 — de database-sleutel is herbouwd.** Migratie 0038 verving de oude sleutel
  `(veiling + spotter)` door een nieuwe interne sleutel + uniek slot
  `(veiling + spotter + dag)`. Dit is het gevoeligste deel. Afgedekt door: een
  geverifieerde back-up (zie §4), de vaststelling dat geen enkele andere tabel
  naar de oude sleutel verwees, en een test die bevestigde dat het uniek slot
  bijt (dubbele "alle dagen"-rij wordt geweigerd). Bestaande 17 toewijzingen
  staan op "alle dagen" → lopende veilingen ongewijzigd.
- **B2 — "alle dagen" vs. dag-specifiek.** Als iemand zowel een "alle dagen"-rij
  als een dag-rij zou hebben, toont de cockpit hem één keer (de dag-rij wint). De
  ⧉- en ✕-acties ruimen de "alle dagen"-rij netjes op (uitwaaieren), zodat er
  geen onverwijderbare rij ontstaat. Visueel te controleren (§3).
- **B3 — botsing met de "o = online"-sneltoets.** Als een spotter met "O" begint,
  kiest `o` voortaan die spotter i.p.v. "online". "Online" blijft bereikbaar via
  de online-knop en de pijltjes ← →. Dit is bewust zo.
- **B1 — foto-upload.** Gebruikt de bestaande Supabase Storage-bucket
  `client-photos` (subfolder `spotters/`). Die bucket is nooit via een migratie
  aangemaakt maar bestaat al (spotters gebruikten hem al). Als upload faalt:
  controleer in de Supabase-console dat de bucket public-read + anon-write heeft.
- **Algemeen:** geen wijziging aan productie-data behalve de additieve
  schema-uitbreiding; de oude code op `main` bleef tijdens de rit werken omdat de
  migratie backward-compatible is.

---

## 3. Wat visueel gecontroleerd moet blijven

1. **A1:** cockpit → lot actief → koper-veld + suggestielijst zijn donker.
2. **A2:** collectie met loten zonder startprijs → rode balk bovenaan +
   per-lot-label; klik de balk → springt naar het eerste lot.
3. **B1:** `/spotters` → fotokaarten, foto-upload blijft staan, huisfilter toont
   enkel spotters met historie bij dat huis, aanvinken → aan veiling toevoegen →
   verschijnt onderaan die collectie.
4. **B2 (meerdaagse veiling, bv. Deauville):** spotter op dag 1 ≠ dag 2; ✕ haalt
   iemand van één dag zonder de andere dag te raken; ⧉ zet iemand op alle dagen;
   cockpit van dag 1 vs. dag 2 toont de juiste set. **Eendaagse veiling:
   ongewijzigd.**
5. **B3:** in de cockpit een letter drukken selecteert/cycelt de juiste spotter;
   typen in een veld doet niets; ↑ ↓ ␣ ← → blijven werken.

---

## 4. Terugdraai-weg (rollback)

### Code
- Per onderdeel terug te draaien via de merge-commits op `main`:
  `git revert <hash>` van de merge (#30 = A1/A2, #31 = B1/B2/B3), of een
  specifieke feature-commit (`dd59872` B1, `9bc2f82` B2, `b028276` B3,
  `4d7e161` A1/A2).
- Of via Vercel → Deployments → een vorige productie-deploy activeren.

### Database (migratie 0038)
- **Vangnet:** de snapshot-tabel **`collection_spotters_backup_0038`** (17 rijen)
  staat nog in de database. Die is **bewust niet opgeruimd** en wacht op
  expliciete bevestiging vóór ze verwijderd wordt (destructieve actie).
- **Data herstellen** (oorspronkelijke toewijzingen terug, in één regel):
  ```sql
  truncate collection_spotters;
  insert into collection_spotters (collection_id, spotter_id, location, display_order, created_at)
  select collection_id, spotter_id, location, display_order, created_at
  from collection_spotters_backup_0038;
  ```
  De nieuwe kolommen (`id`, `collection_day_id`) krijgen hun standaard
  (`collection_day_id` = null = "alle dagen").
- **Volledig schema terugdraaien** (alleen indien echt nodig): de toegevoegde
  kolommen/het uniek slot droppen en de oude PK `(collection_id, spotter_id)`
  herstellen — enkel na backup + bevestiging.

---

## 5. Verificatie deze sessie

- `npm run build` groen op elke feature-commit én op de samengevoegde `main`.
- Migratie 0038 toegepast + getest (back-up geverifieerd 17/17; uniek slot
  bijt; bestaande rijen 100% "alle dagen").
- Merge schoon getest op een wegwerpbranch vóór de echte merge (gedeeld bestand
  `CollectionPage.jsx` → geen conflict). PR's #30 + #31 gemerged; `main` schoon;
  Vercel-productie READY.

**Openstaand voor Frederik:** (a) gecombineerde visuele check op productie;
(b) sein om `collection_spotters_backup_0038` op te ruimen wanneer je tevreden bent.
