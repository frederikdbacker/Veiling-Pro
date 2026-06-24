# Plan — Meerdaagse collectie opsplitsen per veilingdag

**Status:** ontwerp / planning — *nog geen implementatie*
**Datum:** 23 juni 2026
**Auteur:** Claude Code (in opdracht van Frederik)
**Scope:** datamodel + scraper-flow + UI om een binnengehaalde collectie die
over meerdere dagen verkocht wordt, te splitsen in **veilingdagen**.

> Leeswijzer: dit document volgt de gevraagde opbouw — (A) wat de Fences-site
> over de aankomende verkopen vertelt en hóé de meerdaagse structuur daar
> zichtbaar is, (B) hoe veilinghuizen/collecties/lots vandaag in Veiling Pro
> gemodelleerd zijn en wáár de aanname "alles op één dag" zit, en (C) het
> concrete ontwerp + gefaseerd implementatieplan. Aannames zijn als zodanig
> gemarkeerd.

---

## A. Web-research Fences — geverifieerde bevindingen

Bron-pagina's (opgehaald 23 juni 2026):

- Kalender: <https://www.fences.fr/calendrier-ventes-fences/>
- Selection (EN): <https://www.fences.fr/en/deauville-selection-auction/>
- Catalogus (1 URL, beide dagen): <https://www.fences.fr/cheval/vente/selection/>

### De drie verkopen

| Verkoop | Exacte datumtekst op de site | Dagen | Locatie | Meerdaags? |
|---|---|---|---|---|
| **La Vente de Sélection Deauville** | *"Lundi 29 juin et mardi 30 juin"* | ma 29 + di 30 juni 2026 | Pôle International du Cheval Longines, Deauville (14) | **Ja — 2 dagen** |
| La Deauville Classic Auction | *"Samedi 15 août"* | za 15 aug 2026 | Pôle International du Cheval, Deauville (14) | Nee — 1 dag |
| **Les Ventes Élite** | *"Du mercredi 2 septembre au samedi 5 septembre"* | wo 2 t/m za 5 sept 2026 | Espace Marcel Rozier, Bois-le-Roi (77) | **Ja — 4 dagen** |
| La Vente de Service | *"Dimanche 6 septembre"* | zo 6 sept 2026 | Espace Marcel Rozier, Bois-le-Roi (77) | Nee — 1 dag |

> **Correctie t.o.v. de oorspronkelijke briefing:** de "Quality Auction"
> (Zangersheide) is **geen Fences-verkoop** — dat is een ander veilinghuis en
> valt buiten dit plan. Het primaire meerdaagse voorbeeld is **Deauville
> Sélection (2 dagen)**; **Fences Élite (4 dagen)** is het tweede, zwaardere
> voorbeeld om mee te ontwerpen.

### Hóé de meerdaagse structuur op de site zichtbaar is (bepalend voor het ontwerp)

1. **De dag-info zit alleen in de kalendertekst, niet in de catalogus.** De
   kalender toont de dagen als vrije tekst (*"Lundi 29 juin et mardi 30 juin"*,
   *"Du mercredi 2 septembre au samedi 5 septembre"*). De catalogus zelf staat
   op **één enkele URL** (`/cheval/vente/selection/`) voor béíde dagen.

2. **De gescrapete catalogus bevat géén dag-veld.** In onze al binnengehaalde
   `data/fences-selection-2026-import.json` staan 76 paarden met
   `lot_number` 1…76, sequentieel, **zonder enige dag/sessie/vacation-markering**
   (geverifieerd in het JSON-bestand). Een lot weet dus niet op welke dag het
   verkocht wordt.

3. **Lots worden niet in catalogusvolgorde verkocht.** Fences publiceert een
   aparte **"ordre de passage"** (volgorde van doorkomst), los van het
   catalogus-lotnummer. Citaat uit de verkoopverslagen: *"the lots at the
   Deauville auction are not presented in catalog order."* Pagina's als
   `/<verkoop>-ordre-de-passage/` bestaan, maar:
   - worden **pas vlak vóór het event** gepubliceerd (de Selection-variant gaf
     op 23 juni nog **HTTP 500**), en
   - gebruiken een **eigen volgnummer**, niet noodzakelijk het catalogus-lotnummer.

   → **Gevolg:** de échte dag-toewijzing voor Sélection komt uit de *ordre de
   passage*, niet uit het lotnummerbereik. Tot die er is, is er **geen
   betrouwbare automatische** dag-bron en moet de toewijzing handmatig kunnen.

4. **Voor afgesloten Fences-verkopen splitst de bron al per datum.** De
   historische 4D-API (`scripts/scrape-fences-ventes.mjs`, endpoint
   `liste_Ventes` met `param3 = DD-MM-YYYY`) levert resultaten **per datum**;
   het script maakt daar bewust *"Iedere datum wordt een aparte collection"*
   van. Fences houdt resultaten dus intern al per dag bij — voor verleden
   verkopen is de dag-splitsing dus gratis. Het probleem zit uitsluitend bij
   **aankomende** verkopen die via één catalogus-URL binnenkomen.

**Samengevat:** de site geeft de dagen als *datumtekst op kalenderniveau*; de
catalogus is *dag-loos en één URL*; de *ordre de passage* is de enige
gezaghebbende dag-bron en komt laat + in een eigen nummering. Het ontwerp moet
dus werken **zonder** dag-info uit de bron (handmatige toewijzing als basis) en
de *ordre de passage* later kunnen overnemen.

---

## B. Repo-analyse — huidig model en waar "alles op één dag" zit

### Datamodel (live schema, na migratie 0018 rename)

```
auction_houses (1) ──< collections (N) ──< lots (N)
```

- **`auction_houses`** — `id, name (unique), country, website, contact, notes`.
- **`collections`** (heette `auctions`, hernoemd in `0018`) — de "binnengehaalde
  collectie" / één verkoop. Relevante kolommen
  (`supabase/migrations/0001_init.sql` + latere migraties):
  - `id, house_id, name, **date** (één enkele DATE), location, status, notes`
  - `time_auction_start, time_auction_end` (timestamptz) — sessie-timing
  - `active_lot_id` (0004) — welk lot nú in het cockpit actief is
  - `online_bidding_enabled` (0012), `debrief_text` (0023), `rating` (0016)
  - Unique: `(house_id, name)`
- **`lots`** — `collection_id` (FK, hernoemd in 0018), `number` (lotnummer),
  `name, year, gender, sire, dam, photos, …`, prijzen, **`lot_type_id`
  (verplicht, 0013)**, resultaat (`sold, sale_price, buyer_client_id`), en de
  live-timing `time_entered_ring, time_hammer, duration_seconds`.
- **Per-collectie junctions** (alle gekoppeld via `collection_id`):
  `collection_lot_types`, `bid_step_rules`, `collection_breaks` (0011, pauzes),
  `collection_spotters` (0010), `client_collection_seating` (0007).

### Waar de aanname "alles op één dag" structureel zit

De aanname is niet één regel — ze zit ingebakken op vier plekken:

1. **`collections.date` is één `DATE`-kolom.** Eén collectie = één datum. Er is
   geen plek om een tweede verkoopdag vast te leggen. Bij de calendrier-import
   (`scripts/import-fences-calendrier.mjs`) krijgt Deauville Sélection dan ook
   gewoon `date: '2026-06-29'` — de dinsdag valt weg.

2. **De cockpit is één doorlopende sessie over álle lots van de collectie.**
   - `src/pages/CockpitPage.jsx` laadt lots met
     `.from('lots').eq('collection_id', collectionId).order('number')` en
     stuurt de live veiling via `collections.active_lot_id` (één actief lot voor
     de hele collectie).
   - De statusbalk (`CockpitStatusBar`) berekent voortgang, gemiddelde duur en
     **verwacht einduur over álle lots samen** — alsof het één avond is.
   - Pauzes (`collection_breaks`) en spotters (`collection_spotters`) hangen
     aan de hele collectie, niet aan een dag.
   - Route: `/cockpit/:collectionId` (`src/App.jsx:33`) — geen dag-dimensie.

3. **De eindoverzicht-pagina aggregeert de hele collectie als één event.**
   `src/pages/CollectionSummaryPage.jsx` telt alle lots van de `collection_id`
   op tot één omzet/kerncijfer-blok (route `/collections/:id/summary`).

4. **De import maakt één collectie met sequentiële lots.** Zowel
   `scripts/import-fences-catalogus.mjs` (upcoming, één catalogus-URL → 76 lots
   in één `planned`-collectie) als `scripts/import-lots.mjs` (generiek) gaan
   uit van precies één doelcollectie. Geen van beide kent een dag-begrip.

### Waar het model al méé zit dan je zou denken

- **De live 4D-API splitst al per datum** (zie A.4) — voor verleden verkopen is
  "elke datum een eigen collectie" al de praktijk.
- **`@dnd-kit`** is al een dependency (gebruikt voor het slepen van pauzes in
  `CollectionPage.jsx`) — bruikbaar om lots tussen dagen te slepen.
- **Lots hebben al een stabiele her-identificatie** mogelijk via `source_url` /
  `slug` / (voor Fences) `fences_id` — nodig om bij her-scrape de dag-toewijzing
  te behouden.

---

## C. Ontwerp — collectie opsplitsen per veilingdag

### C.0 Mentaal model en kernkeuze

Frederik's formulering — *"collecties opsplitsen in dagen"* — houdt de
**collectie als de container** (de volledige binnengehaalde verkoop, met één
catalogus, één set klanten/biedstaffels) en zet **dagen erbinnen**. Dat sluit
ook aan bij de operationele realiteit: elke dag is een aparte live-avond
(ma 29 om 19u30, di 30 om 19u30) met een eigen doorkomstvolgorde en eigen
verwacht einduur.

**Gekozen architectuur (robuust + backward-compatible):**

> Een nieuwe kindtabel **`collection_days`** onder `collections`. Elk lot krijgt
> een **`collection_day_id`** (welke dag). De live-sessievelden
> (`active_lot_id`, sessie-timing, status) verhuizen naar dag-niveau. Elke
> **bestaande eendaagse collectie krijgt automatisch precies één dag**, zodat
> alles wat er nu is **ongewijzigd blijft werken**.

Waarom deze i.p.v. "elke dag = een aparte collectie + parent-groep"?

- De cockpit (het meest geteste, live-kritische onderdeel) blijft conceptueel
  *één sessie = één dag* draaien; we routen hem alleen per dag i.p.v. per
  collectie. Geen parent-groep-laag erbovenop nodig.
- De catalogus, klanten/seating en biedstaffels blijven **één keer** bestaan op
  collectie-niveau — geen duplicatie per dag.
- Geen tweede pijnlijke hernoeming van "collectie" (na de auctions→collections
  rename van 0018). De betekenis van "collectie" blijft intact; "dag" is nieuw.
- Eendaagse collecties (de overgrote meerderheid) zijn een collectie met één
  dag → nul gedragsverandering.

### C.1 Datamodel-voorstel

**Nieuwe tabel `collection_days`** (additieve migratie, bv. `0031`):

```sql
create table collection_days (
  id              uuid primary key default gen_random_uuid(),
  collection_id   uuid not null references collections(id) on delete cascade,
  day_index       int  not null,              -- 1, 2, 3… volgorde binnen de verkoop
  label           text,                        -- bv. "Dag 1 — maandag", optioneel
  date            date,                         -- de échte datum van déze dag
  -- live-sessievelden, verhuisd van collections → per dag:
  active_lot_id   uuid references lots(id) on delete set null,
  time_session_start timestamptz,
  time_session_end   timestamptz,
  status          text default 'planned',      -- planned / lopend / afgesloten
  created_at      timestamptz not null default now(),
  unique (collection_id, day_index)
);
create index idx_collection_days_collection on collection_days(collection_id);
```

**Op `lots`:**

```sql
alter table lots add column collection_day_id uuid
  references collection_days(id) on delete set null;
create index idx_lots_collection_day on lots(collection_day_id);
```

`collection_day_id` is **nullable** = "nog niet aan een dag toegewezen"
(de unassigned-bak). Lots zonder dag mogen nooit verdwijnen uit de UI.

**Backfill (in dezelfde migratie, idempotent):** voor elke bestaande collectie
exact één dag aanmaken en alle lots eraan koppelen:

```sql
insert into collection_days (collection_id, day_index, date, status)
select id, 1, date, status from collections;

update lots l
set collection_day_id = d.id
from collection_days d
where d.collection_id = l.collection_id and d.day_index = 1
  and l.collection_day_id is null;
```

**Backward-compat met `collections`-velden:**
- `collections.date` **blijft bestaan** als "eerste/representatieve datum" voor
  het huisoverzicht en sortering (`HousePage.jsx` sorteert op `date`). We zetten
  hem gelijk aan de datum van dag 1. De gezaghebbende per-dag-datums staan in
  `collection_days.date`.
- `collections.active_lot_id`, `time_auction_start/end`, `status` worden
  **gedeprecieerd** maar **niet meteen gedropt** (kolommen droppen pas in een
  latere migratie, conform de bestaande projectdiscipline rond 0030). De cockpit
  gaat lezen/schrijven naar `collection_days`.
- **Pauzes → dag-niveau, spotters → collectie-breed** (beslist; zie C.5):
  `collection_breaks` krijgt een nullable `collection_day_id` (backfill naar
  dag 1); `collection_spotters` blijft ongewijzigd op collectie-niveau.
- Biedstaffels (`bid_step_rules`), lot-types en klanten/seating **blijven
  collectie-breed** (gedeeld over alle dagen) — dat is correct: de staffels en
  de klantenlijst gelden voor de hele verkoop.

### C.2 Lots aan de juiste dag toewijzen

Volgorde van bronnen, sterkste eerst:

1. **Ordre de passage (gezaghebbend, maar laat).** Wanneer Fences de
   doorkomstvolgorde publiceert, bevat die de dag-indeling. Plan: een aparte
   `scrape-fences-ordre-passage.mjs` die per dag de paarden leest en matcht op
   onze lots via **stabiele sleutel** (`fences_id` → anders `slug` → anders
   `name`), en dan `collection_day_id` zet. *Open punt:* of die pagina
   scrapebaar is en welk nummer ze draagt (gaf nu HTTP 500) — zie C.7.

2. **Per-datum bron (afgesloten verkopen).** De 4D-API levert al per datum
   (A.4). Bij het importeren van een afgesloten meerdaagse Fences-verkoop maken
   we één `collection_day` per datum en koppelen de paarden van die datum eraan.

3. **Lotnummerbereik per dag (handmatig, optioneel).** Voor verkopen waar een
   aaneengesloten reeks wél met een dag samenvalt: een UI-actie "lots 1–38 →
   dag 1, 39–76 → dag 2". *Niet* de default voor Sélection (lots worden niet in
   catalogusvolgorde verkocht), wél een snelle bulk-helper.

4. **Fallback — geen dag-info uit de bron (de Deauville-realiteit nú).** Alle
   lots landen in de **unassigned-bak** (of automatisch op dag 1). Frederik
   verdeelt ze in de UI via bulk-selectie en/of slepen (C.4). Zodra de ordre de
   passage er is, kan bron #1 de verdeling overschrijven (met audit van wat
   verschoof).

**Deauville-voorbeeld concreet (end-to-end):**

1. `import-fences-catalogus.mjs` haalt de 76 paarden binnen in de bestaande
   `planned`-collectie "La Vente de Sélection Deauville 2026" (ongewijzigd).
2. Een nieuwe stap maakt **twee dagen** aan: dag 1 = 2026-06-29, dag 2 =
   2026-06-30 (uit de calendrier-tekst, zie C.3).
3. Bij gebrek aan ordre de passage staan alle 76 lots eerst op dag 1
   (of unassigned). Frederik splitst, of we draaien
   `scrape-fences-ordre-passage.mjs` zodra die live is.
4. Cockpit ma-avond draait dag 1; di-avond dag 2 — elk met eigen verwacht
   einduur. Het eindoverzicht toont per dag + een verkoop-totaal.

### C.3 Dagen aanmaken bij import / calendrier

- **`import-fences-calendrier.mjs`** uitbreiden zodat een verkoop een
  **dagen-lijst** kan meekrijgen i.p.v. één `date`. Bv.:

  ```js
  { name: 'La Vente de Sélection Deauville 2026',
    location: 'Deauville (14)',
    days: ['2026-06-29', '2026-06-30'] },          // 2 dagen
  { name: 'Les Ventes Élite 2026',
    location: 'Bois-le-Roi (77)',
    days: ['2026-09-02','2026-09-03','2026-09-04','2026-09-05'] }, // 4 dagen
  ```

  Het script maakt de collectie + per datum een `collection_days`-rij
  (`day_index` 1..n) en zet `collections.date` op de eerste dag.
- **Datumtekst → datums:** de kalender geeft Frans ("Du mercredi 2 septembre au
  samedi 5 septembre"). We laten dit **niet** automatisch parsen (foutgevoelig);
  de dagen worden expliciet als ISO-datums in het script/het UI-formulier gezet.
  De bestaande importer converteert DD/MM al naar ISO — dat patroon volgen we.

### C.4 UI — hoe Frederik dit ziet en bestuurt

**`CollectionPage.jsx` — nieuwe sectie "Veilingdagen":**
- Lijst van dagen (datum + optioneel label + lot-telling per dag).
- **Dag toevoegen / bewerken (datum, label) / verwijderen** (verwijderen alleen
  toegestaan als de dag leeg is; anders eerst lots herverdelen — geen
  cascade-verlies).
- **Lots gegroepeerd per dag** in de lotlijst (inklapbare dag-kop), met een
  zichtbare **"Niet toegewezen"-groep** bovenaan als er lots zonder dag zijn.
- **Lots herverdelen:**
  - bulk-selectie (checkbox) + "→ verplaats naar dag X";
  - drag-and-drop van een lot naar een dag-kop (hergebruik `@dnd-kit`, al in
    gebruik voor pauzes);
  - snelle "lots A–B → dag X"-helper (bron #3).
- **Auto-save** conform de bestaande conventie (geen Enter-verplichting — zie
  de geleerde les rond `SpottersField`).

**Cockpit:** route wordt `/cockpit/:collectionId/:dayId?`.
- Bij een eendaagse collectie: `dayId` weglaten → automatisch de enige dag
  (gedrag identiek aan nu).
- Bij meerdere dagen: een **dag-kiezer** bovenaan; de sessie (active_lot,
  statusbalk, verwacht einduur en **pauzes**) draait over **die dag**. De
  **spotters-strip blijft collectie-breed** (dezelfde spotters elke dag).
- `active_lot_id` lezen/schrijven we op `collection_days`, niet meer op
  `collections`.

**Eindoverzicht (`CollectionSummaryPage.jsx`):** per dag een blok
(kerncijfers van die dag) **plus** een verkoop-totaal over alle dagen. Bij een
eendaagse collectie ziet dit er uit als nu (één blok).

**Huisoverzicht (`HousePage.jsx`):** een meerdaagse collectie blijft één regel;
toon de datum als reeks ("29–30 juni 2026") wanneer er >1 dag is.

### C.5 Wat collectie-breed blijft en wat naar dag-niveau gaat

> **Beslist door Frederik (23 juni 2026):** spotters blijven hetzelfde over de
> hele verkoop; pauzes worden **per veilingdag** ingesteld.

- **Collectie-breed (gedeeld over alle dagen):**
  - **Spotters (`collection_spotters`)** — dezelfde spotters over de hele
    verkoop. Blijft ongewijzigd op collectie-niveau; de cockpit toont per dag
    dezelfde spotters-strip.
  - **Biedstaffels (`bid_step_rules`) + lot-types + klanten/seating** — één
    staffel en één klantenlijst gelden voor de hele verkoop; klanten kopen over
    dagen heen.
- **Per veilingdag (dag-niveau):**
  - **Pauzes (`collection_breaks`)** — verhuizen naar dag-niveau. Een pauze
    hoort bij een specifieke avond (BIS-blokken, doorkomstvolgorde per dag).
    Migratie (additief): nullable `collection_day_id` op `collection_breaks`;
    bestaande pauzes worden bij de backfill aan dag 1 gekoppeld. De cockpit en
    `CollectionPage` filteren pauzes op de actieve dag. Pauzes worden dus
    **samen met de cockpit-wijziging** dag-bewust gemaakt (Fase 3), niet later.

### C.6 Edge cases

| Geval | Aanpak |
|---|---|
| **Bron geeft geen dag** (Deauville nu) | Lots → unassigned/dag 1; handmatige verdeling; ordre de passage later. |
| **Dag verschuift** (weer/uitstel) | Wijzig `collection_days.date`; lot↔dag-koppeling hangt aan `day_id`, niet aan de datum → geen verlies. |
| **Lots wisselen van dag bij her-scrape** | Match op stabiele sleutel (`fences_id`/`slug`); **behoud bestaande `collection_day_id`** tenzij expliciet her-afgeleid; log welke lots verschoven (audit-spoor). Nooit blind overschrijven. |
| **Tijdzones / datumformaat** | `date`-kolommen blijven `DATE` (geen tz); sessietijden `timestamptz`; weergave nl-BE. Franse DD/MM → ISO bij import (bestaand patroon). |
| **Teruggetrokken lot (0027)** | Telt correct in de per-dag-stats; verschijnt onder de juiste dag met withdrawn-markering. |
| **Lot zonder dag tijdens live** | Cockpit-dag toont alleen lots van die dag; unassigned-lots blijven zichtbaar op `CollectionPage` zodat niets "verdwijnt". |
| **Dag verwijderen met lots erin** | Geblokkeerd; eerst herverdelen. |

### C.7 Open vragen en risico's

1. **Ordre de passage scrapebaar?** De `/<verkoop>-ordre-de-passage/`-pagina's
   gaven HTTP 500 (nog niet gepubliceerd voor Sélection). Onbekend of ze het
   catalogus-lotnummer dragen of een eigen volgnummer, en of ze server-rendered
   zijn. **Actie:** opnieuw proberen dichter bij 29 juni; desnoods via de
   Chrome-tools. Tot dan is handmatige verdeling de werkbare basis.
2. **`collections.date` semantiek** — we houden 'm als "eerste dag" voor
   sortering; geen functioneel risico, wel documenteren.
3. **Migratievolgorde** — additieve migratie (0031) draaien **vóór** de
   code-deploy die `collection_days` leest; backup vóór de schemawijziging
   (projectregel).

**Beantwoord door Frederik (23 juni 2026), verwerkt in het ontwerp:**

- ✅ **Spotters/pauzes per dag of per verkoop?** Spotters blijven
  **collectie-breed** (hetzelfde over de hele verkoop); pauzes worden **per
  veilingdag** ingesteld. Verwerkt in C.1, C.4 en C.5; pauzes-per-dag zit in
  Fase 3.
- ✅ **UI-terminologie?** "**Veilingdag**" (kort: "dag") is de UI-term;
  "**collectie**" blijft de hele verkoop.

---

## Gefaseerd implementatieplan (Claude-Code-klaar)

Elke fase eindigt met een groene `npm run build` en is op zichzelf deploybaar.

### Fase 1 — Schema + backfill (geen gedragsverandering)
- [ ] `supabase/migrations/0031_collection_days.sql`: tabel `collection_days`,
      `lots.collection_day_id`, indices, RLS-policy (permissive, als de rest),
      backfill (1 dag per bestaande collectie, alle lots gekoppeld),
      `collections.date` = dag 1. **Backup vóór uitvoeren.**
- [ ] Verifiëren: elke collectie heeft exact 1 dag; lot-tellingen onveranderd.
- **Test:** count-check per collectie (#dagen = 1, #lots/dag = #lots/collectie).

### Fase 2 — Dagen beheren in de UI + lots herverdelen
- [ ] `src/lib/collectionDays.js`: get/create/update/delete + `assignLotToDay`
      + `bulkAssign` (volg het patroon van `breaks.js` / `spotters.js`).
- [ ] `CollectionPage.jsx`: sectie "Veilingdagen" (toevoegen/bewerken/
      verwijderen, dag verwijderen geblokkeerd als niet leeg).
- [ ] Lotlijst groeperen per dag + "Niet toegewezen"-groep; bulk-verplaatsen +
      drag-and-drop (`@dnd-kit`, hergebruik pauze-patroon) + "lots A–B → dag X".
- **Test:** Deauville-fixture (76 lots, 2 dagen) handmatig splitsen; auto-save
      zonder Enter; lots verdwijnen nooit.

### Fase 3 — Cockpit + overzicht dag-bewust (incl. pauzes per dag)
- [ ] Migratie `0032_breaks_per_day.sql`: nullable `collection_day_id` op
      `collection_breaks`; backfill bestaande pauzes naar dag 1.
- [ ] Route `/cockpit/:collectionId/:dayId?` (`App.jsx`); default = enige dag.
- [ ] `CockpitPage.jsx`: dag-kiezer; lots **en pauzes** filteren op
      `collection_day_id`; `active_lot_id` + sessietiming lezen/schrijven op
      `collection_days`; statusbalk verwacht-einduur **per dag**. Spotters-strip
      blijft collectie-breed (ongewijzigd).
- [ ] `CollectionPage.jsx`: pauze-beheer per dag (een pauze hoort bij een dag).
- [ ] `CollectionSummaryPage.jsx`: per-dag-blok + verkoop-totaal.
- [ ] `HousePage.jsx`: datumreeks tonen bij >1 dag.
- **Test:** eendaagse collectie = identiek gedrag (regressie); 2-dagen-cockpit
      per avond met eigen pauzes; gedeelde spotters tonen op elke dag; summary
      per dag + totaal kloppen.

### Fase 4 — Import/scrape dag-bewust
- [ ] `import-fences-calendrier.mjs`: `days: []` ondersteunen → dagen aanmaken.
- [ ] `import-fences-catalogus.mjs` / `import-lots.mjs`: optioneel `day_index`
      of datum per paard respecteren; anders unassigned/dag 1.
- [ ] `scrape-fences-ordre-passage.mjs` (nieuw): doorkomstvolgorde per dag
      scrapen en `collection_day_id` zetten via stabiele-sleutel-match;
      her-scrape behoudt handmatige toewijzingen + logt verschuivingen.
- **Test:** her-import idempotent; handmatige dag-toewijzing blijft behouden.

> **Vervallen:** een aparte "per-dag spotters"-fase is niet nodig — spotters
> blijven collectie-breed (beslist door Frederik). Pauzes-per-dag is verplaatst
> naar Fase 3 hierboven.

### Latere opruiming
- [ ] Gedeprecieerde `collections`-kolommen (`active_lot_id`,
      `time_auction_start/end`) droppen — pas nadat alles op `collection_days`
      draait (eigen migratie, conform 0030-discipline).

---

## Samenvatting

- **Geverifieerde data (Fences):** Deauville **Sélection = ma 29 + di 30 juni
  2026** (2 dagen, één catalogus-URL `/cheval/vente/selection/`); **Fences Élite
  = wo 2 t/m za 5 sept 2026** (4 dagen). De "Quality Auction" is **Zangersheide,
  geen Fences** — buiten scope.
- **Hoe de site de dagen structureert:** de dagen staan als **datumtekst op de
  kalender**, de **catalogus is dag-loos en één URL**, en de échte dag-indeling
  zit in de laat-gepubliceerde **"ordre de passage"** (eigen volgnummer, geen
  catalogusvolgorde). Conclusie: het ontwerp moet werken **zonder** dag-info uit
  de bron (handmatige verdeling als basis) en de ordre de passage later kunnen
  overnemen.
- **Waar de "één dag"-aanname zit:** `collections.date` (één DATE), de cockpit
  als één sessie over alle lots (`active_lot_id`, verwacht-einduur), het
  eindoverzicht als één event, en de import die één collectie met sequentiële
  lots maakt.
- **Ontwerp:** kindtabel **`collection_days`** + **`lots.collection_day_id`**;
  live-sessievelden naar dag-niveau; **elke bestaande collectie krijgt
  automatisch één dag** (volledig backward-compatible). **Spotters,
  biedstaffels, klanten/seating blijven collectie-breed; pauzes gaan naar
  dag-niveau** (beslist door Frederik). Gefaseerd: schema → dagbeheer-UI →
  cockpit/overzicht dag-bewust (incl. pauzes per dag) → import/scrape.
- **UI-term:** "**veilingdag**"; "**collectie**" = de hele verkoop.

**Documentpad:** `docs/plan-meerdaagse-collectie-opsplitsing.md`
