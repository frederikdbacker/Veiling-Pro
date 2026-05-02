# Audit — Pauzes + sorteer + online-toggle + summary-link + drag-and-drop

**Datum:** 2 mei 2026 (extra sessie ná de redesign-marathon-afsluiting)
**Sessie:** Code (vanaf MacBook)
**Type:** AuctionPage-uitbreidingen — twee migraties, vier features,
drie commits

---

## Wat is er gewijzigd in deze sessie

### Migraties

- **0011_auction_breaks.sql** — nieuwe tabel `auction_breaks` voor
  pauzes (BIS-blokken) tussen lots. Velden: `auction_id`,
  `after_lot_number`, `title` (default "Pauze"), `description`,
  `duration_minutes`. Index op `(auction_id, after_lot_number)`.
- **0012_online_bidding.sql** — `auctions.online_bidding_enabled`
  bool, default false. Bepaalt of "Verkocht online" zichtbaar is in
  de cockpit hamer-form.

### Pauzes + sorteer-toggle (commit 2e11d99)

- **`src/lib/breaks.js`** — get / create / update / delete helpers.
- **AuctionPage** sorteer-toggle bovenaan: `# Lotnummer` (default) ↔
  `A-Z naam`. Actieve modus heeft accent-groen achtergrond.
- **"+ Pauze toevoegen"** opent inline-form met:
  - "Na lot" dropdown (lots gesorteerd op number) → BIS-label preview
    `${after_lot_number} BIS` automatisch
  - Titel (default "Pauze")
  - Duur in minuten
  - Info (vrije tekst)
- **Pauze-rij** visueel onderscheidend: ⏸-icoon in donkere cirkel,
  BIS-label in mono-accent met dunne rand, titel + duur + info,
  ✏-bewerk en ✕-verwijder.
- **Plek**: bij Lotnummer-sortering ingevoegd in de lots-lijst direct
  na het matching lot. Bij A-Z-sortering los onderaan in een eigen
  "Pauzes"-sectie.
- **Orphan-breaks** (after_lot_number niet matcht een bestaand lot)
  komen onderaan in "Pauzes zonder positie".

### Online-toggle + summary-link (commit bb9e556)

- **AuctionPage action-row** onder de titel:
  - 🎬 Cockpit openen (primary-accent)
  - 📊 Overzicht (link naar `/auctions/:id/summary`)
  - 📋 Link kopiëren (clipboard-write naar
    `${window.location.origin}/auctions/{id}/summary`) met
    "✓ Link gekopieerd"-feedback (2.5 sec)
  - Rechts: "Online biedingen actief"-checkbox die direct DB patcht
- **CockpitPage** auctions-query haalt nu `online_bidding_enabled`
  mee, doorgegeven via `ActiveLotPanel` → `CockpitControls`.
- **Hamer-form** in cockpit: "Verkocht online"-radio enkel zichtbaar
  als `onlineBiddingEnabled === true`. "Verkocht in zaal" en "Niet
  verkocht" altijd beschikbaar.

### Drag-and-drop pauzes (commit ba12d3b)

- **NPM packages**: `@dnd-kit/core`, `@dnd-kit/sortable`,
  `@dnd-kit/utilities`.
- **`SortableLotRow`**: `useSortable({disabled:true})` — niet
  sleepbaar maar wél drop-target zodat breaks ertussen gedropt
  kunnen worden.
- **`SortableBreakRow`**: useSortable met drag-handle ⠿ (touchAction:
  none voor mobiele tablet-sleep). Tijdens slepen: opacity 0.5 +
  smooth transform-transition.
- **`handleDragEnd`**: `arrayMove` + scan back voor het lot direct
  boven de nieuwe positie → `updateBreak(after_lot_number)`.
- **PointerSensor** met `activationConstraint: distance: 5` voorkomt
  accidentele drags bij gewone klikken op ✏ of ✕ knop.
- **Drag uitgeschakeld** bij A-Z-sortering (geen logische volgorde
  voor pauzes daar).

---

## Live URLs

- **Productie / iPad-bookmark voor 5 mei**:
  https://veiling-pro.vercel.app
- **AuctionPage met nieuwe features**:
  https://veiling-pro.vercel.app/auctions/bef304a5-29fc-47b3-af37-e808205ae60d

---

## Nog door Frederik te doen vóór 5 mei

1. **Migratie 0012 runnen** in Supabase SQL Editor:
   ```sql
   alter table auctions
     add column if not exists online_bidding_enabled boolean not null default false;
   ```
   (Migratie 0011 is al gerund volgens vorige bevestiging.)

2. **Pauzes inrichten** — voeg de juiste BIS-blokken toe (na lot N) met
   titel, duur en eventueel info-tekst.

3. **Online biedingen-toggle** — vink aan als Aloga 2026 online biedingen
   ondersteunt; anders laat uit. Dit verbergt automatisch de "Verkocht
   online"-optie tijdens hameren.

4. **Spotters opnieuw invoeren** (migratie 0010 dropte vroegere data).

5. **iPad-test in landscape**:
   - Drag-and-drop op tablet werkt? Sleep een pauze en check de nieuwe
     positie.
   - 📋 Link kopiëren werkt op iPad Safari?
   - Hamer-modal: zonder online-toggle alleen 2 radios; met aan ook
     "Verkocht online".

6. **Reset-data vlak voor 5 mei** via `scripts/reset-auction.sql`.

---

## Wat zou fout kunnen gaan

- **Drag-and-drop op iPad Safari** — `@dnd-kit` ondersteunt touch via
  `PointerSensor` + `touchAction: none`. Mocht het stuur, kan een
  `TouchSensor` toegevoegd worden (extra import, kleine wijziging).
- **Bundle is groter dan 500kB** — Vite warning. Niet kritisch voor
  functionaliteit; eventueel later code-splitting voor de cockpit-
  routes als laad-tijd op iPad een issue blijkt.
- **Clipboard API** vereist HTTPS — werkt op productie (vercel.app),
  werkt **niet** op http://localhost behalve in moderne browsers met
  localhost als secure context. Op productie geen probleem.
- **Pauzes met after_lot_number = null** verschijnen onderaan in
  "Pauzes zonder positie". Frederik kan via ✏ alsnog een lot kiezen.

---

## Hoe rollback indien nodig

- Per commit: `git revert <hash> && git push`
- Schema: `drop table auction_breaks` voor pauzes; `alter table auctions
  drop column online_bidding_enabled` voor toggle
- Vercel-deploy: dashboard → Deployments → vorige Ready → Promote

---

## Resterend werk na 5 mei

- "Kopieer bid-step-staffel van vorige veiling" (Frederik 30-04)
- Range-overlap-validatie in BidStepRulesEditor
- Drop deprecated kolommen (`lots.bid_steps`, `lots.lot_type`,
  `lots.buyer`)
- Foto-upload voor spotters via Supabase Storage (nu URL-veld)
- Klanten-overzichtspagina (alle klanten van het huis op één plek)
- Code-splitting voor laad-performance op iPad (Vite chunk-warning)
