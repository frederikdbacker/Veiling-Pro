# Audit — Klanten-UI met seating en koper-tracking

**Datum:** 2 mei 2026 (later op de dag, na sessie 1 met Vercel + cockpit-statusbalk + summary)
**Sessie:** Code (vanaf MacBook — repo gekloond, niet de Mac Mini)
**Type:** Migratie 0007 + nieuwe UI-feature + uitbreidingen op cockpit

---

## Wat is er gewijzigd

### Schema (migratie 0007 — additief, gerund door Frederik in Supabase)

1. **`clients.house_id`** (uuid, FK → auction_houses, on delete cascade)
   — klant hoort bij een veilinghuis. Cross-veiling reuse.
2. **Tabel `client_auction_seating`** (client_id, auction_id, table_number,
   direction, notes, created_at) — tafel/richting/opmerking per (klant,
   veiling). Primary key (client_id, auction_id). RLS permissive zoals
   andere tabellen.
3. **`lots.buyer_client_id`** (uuid, FK → clients, on delete set null) —
   koper als koppeling. Bestaande `lots.buyer` text blijft staan voor
   backwards compat.

Indexen: `idx_clients_house`, `idx_seating_auction`, `idx_lots_buyer_client`.

### Code

| Bestand | Status |
|---|---|
| `src/lib/clients.js` | nieuw — helpers voor zoeken/creëren/seating/koppeling/aankopen |
| `src/components/InterestedClientsField.jsx` | nieuw — sectie op LotPage met autocomplete + auto-fill |
| `src/components/BuyerAutocomplete.jsx` | nieuw — koper-input voor cockpit hamer-form, geïnteresseerden bovenaan met ★ |
| `src/pages/LotPage.jsx` | uitgebreid — `<InterestedClientsField>` ingevoegd tussen Voorbereiding en Notities |
| `src/pages/CockpitPage.jsx` | uitgebreid — query via `getInterestedClientsForLot`, render met tafel/richting/seating-opmerking + "al gekocht"-indicator, hamer-form met koper-input, commit met `buyer_client_id` |
| `scripts/reset-auction.sql` | uitgebreid — sectie 4 (uit-gecomment) wist optioneel alle Aloga-klanten met cascade |

Commit: **e912161**.

---

## Live URLs

- **Productie:** https://veiling-pro.vercel.app
- **Cockpit Aloga voor 5 mei:** https://veiling-pro.vercel.app/cockpit/bef304a5-29fc-47b3-af37-e808205ae60d

---

## Wat is functioneel getest

Door Frederik handmatig op localhost (Vite HMR) en/of productie (Vercel auto-deploy):

- [x] Klant toevoegen op LotPage met alle 4 velden + paard-specifieke notitie
- [x] Klant op tweede lot → autocomplete + auto-overname tafel/richting/opmerking
- [x] Klant verwijderen via [✕] (klant blijft staan in `clients`-tabel)
- [x] Cockpit toont tafel/richting bij geïnteresseerden
- [x] Hamer-form: koper-veld toont bij verkocht (zaal/online), verborgen bij niet-verkocht
- [x] Koper-veld: leeg laten, nieuwe naam, of klikken op ster-suggestie
- [x] Na hamer met koper: andere paarden waar koper geïnteresseerd was tonen "✓ al gekocht: #X"

---

## Wat zou fout kunnen gaan

- **Naam-deduplicatie** is bewust niet op DB-niveau. Als Frederik per
  ongeluk twee keer "Janssens" typt zonder de autocomplete-suggestie aan
  te klikken, krijgt hij twee afzonderlijke clients-rows. Dat is by
  design (twee personen met dezelfde naam moeten naast elkaar bestaan)
  maar wel iets om te checken bij echte productie-data. Workaround:
  altijd autocomplete-suggestie aanklikken als die verschijnt.
- **Cursor-positie** in koper-input is een gewone text-input zonder
  formatting — geen issue.
- **Auto-overname overschrijft** bij selecteren van suggestie altijd de
  velden tafelnummer/richting/opmerking. Als gebruiker eerst manueel
  iets had ingevoerd en daarna een suggestie kiest, wordt het overschreven.
  Acceptabel: gebruiker kan na overname nog aanpassen voor save.
- **Herladen `purchasesByClient`** in cockpit gebeurt na elke
  `onLotUpdated`. Performance is OK voor 24 lots × paar geïnteresseerden,
  maar bij grotere veilingen kan dit een hotspot worden. Niet relevant
  voor 5 mei.

---

## Wat moet visueel gecontroleerd worden vóór 5 mei

- [ ] iPad-test: klanten-formulier op tablet bruikbaar? Autocomplete-
      dropdown leesbaar?
- [ ] Cockpit hamer-form met koper-input op iPad: passen alle velden
      onder elkaar? Geen layout-breuk?
- [ ] **Reset-data**: `scripts/reset-auction.sql` runnen vóór 5 mei.
      Optioneel sectie 4 actief om test-klanten te wissen (haal `/* */`
      weg als je een schone klant-database wilt op 5 mei).

---

## Hoe rollback

**Code-rollback:**
- `git revert e912161 && git push` → UI weg, lots.buyer_client_id zit
  nog wel in DB (geen data verloren).

**Schema-rollback** (alleen als migratie 0007 problematisch blijkt):

```sql
-- Verwijdert nieuwe tabellen en kolommen. Cascade neemt afgeleide
-- data mee. Eerst overwegen: er is mogelijk al echte data!
DROP TABLE IF EXISTS client_auction_seating;
ALTER TABLE clients DROP COLUMN IF EXISTS house_id;
ALTER TABLE lots DROP COLUMN IF EXISTS buyer_client_id;
```

---

## Resterend werk

### Vóór 5 mei (gebruiker-acties)
1. iPad-test cockpit landscape
2. `scripts/reset-auction.sql` runnen (eventueel met sectie 4 actief)

### Optioneel vóór 5 mei (code-werk)
- Cockpit stap 5 — notities bewerkbaar in de cockpit (✏-knop per veld)

### Na 5 mei
- Klant bewerken in UI (nu: verwijder + opnieuw toevoegen)
- Klanten-overzichtspagina (alle klanten van het huis)
- "Kopieer bid-step-staffel van vorige veiling"
- Drop deprecated kolommen (`lots.bid_steps`, `lots.lot_type`, `lots.buyer`)
- Range-overlap-validatie in bid-step-editor
