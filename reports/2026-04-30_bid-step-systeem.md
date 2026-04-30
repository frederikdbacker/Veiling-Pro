# Sessieaudit — bid-step-systeem af

**Datum:** 30 april 2026
**Machine:** Mac mini van Conceptosaurus
**Sessietype:** Code (Claude Code in `~/veiling-pro/`)
**Voorgaande audit:** zie `reports/2026-04-30_inline-edit.md`
**Aansluiting:** doorlopende sessie — dit is iteratie 3 op dezelfde dag

---

## Wat is er gebeurd?

In één doorlopende sessie is het volledige bid-step-systeem gebouwd —
het sub-project dat Frederik (op 30-04) verkoos boven de live cockpit.
Zes commits, één migratie, één REST-backfill.

### Schema-uitbreiding (commit `765215c` — migratie 0003)
- `lot_types` (referentie) + 8 seed-types: Veulen, Embryo, Draagmoeder,
  Fokmerrie, Hengst gekeurd, Hengst niet gekeurd, Sportpaard springen,
  Sportpaard dressuur
- `auction_lot_types` — junction (welke types in welke veiling)
- `bid_step_rules` — staffels per (veiling, type) met range_from /
  range_to (NULL = ∞) / step
- `lots.lot_type_id` — FK naar lot_types (oude tekst-kolom blijft
  deprecated, drop later)
- RLS-policies volgen het permissive MVP-patroon

### Backfill (REST PATCH)
- 19 lots met discipline="Springen" → sport-jumping
- 5 lots met discipline="Dressuur" → sport-dressage
- `auction_lot_types` voor Aloga 2026: beide types

### UI op AuctionPage
- **commit `02cfdfa`** — LotTypesSelector: opvouwbaar kadertje met 8
  checkboxes. Toggle insert/delete in auction_lot_types met busy-state.
- **commit `e76a918`** — BidStepRulesEditor: per geselecteerd type een
  mini-tabel "Van €X tot €Y stap €Z" met inline auto-save (AutoSaveNumber
  uitgebreid met label-loze compact mode). "+ Regel toevoegen" en 🗑.
  - Edge-case fix: rules werden hervetched bij selectie-verandering om
    te voorkomen dat een uitgevinkt-en-opnieuw-aangevinkt type een leeg
    blok toonde tot een page-refresh.

### UI op LotPage
- **commit `fd6f793`** — LotTypeDropdown: dropdown om het lot-type van
  een paard te kiezen. Toont enkel de aangevinkte types van de veiling.
- **commit `fd6f793`** — BidStepRulesPreview: read-only weergave van de
  staffel voor het gekozen type. Geen inputs, alleen referentie.

### Helper-functie
- **commit `fd6f793`** — `src/lib/bidSteps.js` met
  `nextBidStep(currentBid, rules)` en `sortByRangeFrom(rules)`.
  Conventie: `[range_from, range_to)`, `null` = oneindig. Gevalideerd
  met 6 testcases via `node -e`-sanity-check.

### PROJECT_STATUS bijgewerkt
- Bid-step-blok afgevinkt incl. alle commit-hashes.
- Toekomstig blok ingevuld met:
  - "Kopieer staffel van vorige veiling" (Frederik's wens, bv. Aloga
    2027 erft van Aloga 2026)
  - Range-overlap-validatie
  - Drop deprecated kolommen
- Eerstvolgende stap nu duidelijk: Live Cockpit (Dag 4-5).

---

## Wat zou er fout kunnen gaan?

### 1. Range-overlap stilzwijgend
**Wat:** twee regels kunnen overlappen (bv. 0-10000 + 5000-15000). De
helper `nextBidStep` neemt de eerste matching regel. Geen waarschuwing.
**Detectie:** cockpit toont een onverwachte step terwijl je dacht een
andere te krijgen.
**Oplossing:** validatie + visuele ⚠ in BidStepRulesEditor wanneer een
regel overlap heeft met een andere voor hetzelfde type. Niet voor MVP.

### 2. Bid_step_rules verweesd na onaanvinken type
**Wat:** wanneer je een type onaanvinkt in LotTypesSelector, blijven de
bijbehorende regels in DB staan (gewoon verstopt in UI). Vink je het
weer aan, dan verschijnen ze terug. Dat is gewenst gedrag, maar in
zeldzame gevallen kan dit leiden tot "verloren" rules wanneer je dezelfde
auction in twee tabbladen edit.
**Detectie:** UI toont andere staffels dan DB.
**Oplossing:** Supabase realtime subscriptions. Niet voor MVP.

### 3. Lot.lot_type_id kan verwijzen naar onaangevinkt type
**Wat:** als je een type onaanvinkt in LotTypesSelector terwijl er nog
lots bestaan met dat type, blijft `lots.lot_type_id` op dat (nu verstopte)
type. Op LotPage toont de dropdown alleen aangevinkte types — de huidige
selectie wordt zichtbaar als blanco (`— kies —`).
**Detectie:** sommige paarden tonen plots "— kies —" als type.
**Oplossing:** óf altijd het huidige type tonen ook als niet aangevinkt,
óf bij onaanvinken automatisch lots opschonen. Beslissing voor later —
voor nu acceptabel.

### 4. Inline-edit van range_to op een tussenliggende regel kan een gat
   creëren
**Wat:** als regel "10000–25000" wordt aangepast naar "10000–20000", komt
er een gat van 20000–25000 zonder match. `nextBidStep` retourneert dan
`null` voor prijzen in dat gat.
**Detectie:** cockpit zegt "geen step bekend".
**Oplossing:** UI-validatie of auto-fill. Niet voor MVP — we gokken op
zorgvuldige invoer.

### 5. Time-to-deadline
**Wat:** vandaag 30-04, deadline 5-05. Drie iteraties op één dag is
goed tempo, maar Live Cockpit is grotere kluif (Dag 4-5 in projectplan).
Begin sessie morgen of dinsdag.
**Oplossing:** plan-mode cockpit nadrukkelijk lean houden.

---

## Wat moet visueel gecontroleerd worden?

Tijdens deze sessie al gedaan door Frederik (alle stappen "werkt").
Voor toekomstige sessies — typische sanity-check:

1. `/auctions/<aloga-uuid>` → Lot-types: 2 aangevinkt. Biedstappen-sectie
   toont voor elk aangevinkt type een (lege of gevulde) regel-lijst.
2. Voeg een regel toe → save-indicator → refresh → regel staat er.
3. Verwijder een regel → bevestigen → regel weg.
4. Op een paard: dropdown toont enkel aangevinkte types, preview-blokje
   toont staffel of empty-state.

---

## Hoe rollback?

### Code rollback
```
git revert fd6f793   # haalt LotTypeDropdown + preview + helper weg
git revert e76a918   # haalt staffel-editor weg
git revert 02cfdfa   # haalt LotTypesSelector weg
git revert 765215c   # alleen het migratie-bestand uit git (DB blijft!)
git push
```

### Database rollback voor migratie 0003
```sql
-- Drop FK eerst
alter table lots drop column if exists lot_type_id;

-- Drop tabellen (cascade verwijdert ook FKs naar deze)
drop table if exists bid_step_rules cascade;
drop table if exists auction_lot_types cascade;
drop table if exists lot_types cascade;
```
**Pas op:** dit verwijdert ALLE staffels en type-toewijzingen.

---

## Stand op het einde van deze iteratie

| | |
|---|---|
| Repo-status | 17 commits op `main`, alles gepusht zodra deze docs-iteratie pusht |
| Database | `auction_houses` 1, `auctions` 1, `lots` 24, `lot_types` 8, `auction_lot_types` 2, `bid_step_rules` 0+ (afhankelijk van Frederik's invoer) |
| Lot-types in Aloga 2026 | Sportpaard springen + Sportpaard dressuur |
| Voorbereidingsmodule | volledig af |
| Bid-step-systeem | volledig af |
| Cockpit | nog niet gestart |
| Vercel-deploy | nog niet gestart |

## Volgende stap

> **Plan-mode Live Cockpit** — minimale interface voor tijdens de veiling.
> "In de piste" / "Hamer" knoppen, live timer per lot, tempo-indicator,
> verwacht einduur. Gebruikt automatisch de bid-staffel via `nextBidStep`.
> Lean blijven om binnen deadline te passen.
