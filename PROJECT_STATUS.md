# PROJECT_STATUS — Veiling-Pro

**Laatste update: 2 mei 2026**
**Deadline: 5 mei 2026 (Aloga Auction 2026)**

---

## Huidige status: COCKPIT + OVERZICHT LIVE OP VERCEL

Vier modules werken end-to-end op productie (https://veiling-pro.vercel.app):

1. **Voorbereidingsmodule** — Veilinghuizen → Veilingen → Lots → Detail
   met foto-gallery, catalog/EquiRatings, video, drie auto-save notes,
   inline edit voor lot-nummer/startprijs/reserveprijs (met duizendscheiding),
   drie URL-velden (Hippomundo/Horsetelex/extra), vorig/volgend met
   pijltjestoetsen.
2. **Bid-step-systeem** — per veiling welke lot-types, per (veiling, type)
   een staffel met ranges + steps (alle bedragen met duizendscheiding),
   lot-type per paard, read-only preview op LotPage, `nextBidStep` helper.
3. **Live Cockpit** (5 van 6 stappen af) — `/cockpit/:auctionId` met
   read-only paard-info, drie-knop-flow (IN DE PISTE → START BIEDEN →
   HAMER) met live timer en next-lot-knop, hamer-form (zaal/online/niet-
   verkocht), én bovenin een **statusbalk** met X/24 gehamerd, omzet,
   gem. duur en verwacht einduur (live update na elke hamer).
4. **Overzichtspagina einde veiling** — `/auctions/:id/summary` met
   kerncijfers, splitsing per lot-type en lot-voor-lot resultaat. Werkt
   ook tijdens lopende veiling (toont "(veiling nog bezig)"). Op cockpit
   verschijnt een groene "Overzicht einde veiling →"-knop zodra alle
   lots gehamerd zijn.

Vercel-deploy is rond met SPA-fallback via `vercel.json`. Elke push naar
`main` triggert een nieuwe deploy. Database ongewijzigd (1 huis, 1 veiling
met datum+locatie+starttijd, 24 lots met enriched data, 8 lot-types,
clients-tabel klaar maar leeg).

Open vóór 5 mei: notities bewerkbaar in cockpit (stap 5), eindtijd Aloga
2026 invullen, drop deprecated columns. Geen van deze blokkeert het
veilen op 5 mei. Cockpit is **volledig bruikbaar op iPad** via de
gepubliceerde URL.

---

## Wat klaar is

### Architectuur & beslissingen
- ✅ Stack beslist: React (Vite) + Supabase + Vercel
- ✅ Geen Notion, geen externe platforms — volledig custom
- ✅ GitHub repo aangemaakt: https://github.com/frederikdbacker/Veiling-Pro
- ✅ Supabase project aangemaakt: https://cjxtwzmryrpwoydrqqil.supabase.co

### Code — repo opgezet (commits a6e4ea7, 35a43f9)
- ✅ Vite-project geïnitialiseerd in `~/veiling-pro/` (zelfstandige map, los van fei-system)
- ✅ React 18, Supabase JS-client geïnstalleerd en bedraad via `src/lib/supabase.js`
- ✅ `.env.local` ingevuld met Supabase URL + publishable key (NIET in git)
- ✅ `.env.example` als template (wel in git)
- ✅ Build slaagt — `npm run build` ✓
- ✅ Smoke-test in `src/App.jsx` toont aantal `auction_houses` uit Supabase

### Database — live op Supabase
- ✅ Migratie 0001: drie tabellen `auction_houses` / `auctions` / `lots` (RLS aan, permissive MVP-policies)
- ✅ Migratie 0002: `bid_steps` verhuisd van lots naar auctions
- ✅ Migratie 0003: bid-step-systeem (`lot_types`, `auction_lot_types`, `bid_step_rules`, `lots.lot_type_id`)
- ✅ Migratie 0004: cockpit + klanten-fundament (`auctions.active_lot_id`, `lots.time_bidding_start`, `clients`, `lot_interested_clients`)
- ✅ Migratie 0005: drie URL-velden op lots (`url_hippomundo`, `url_horsetelex`, `url_extra`)
- ✅ Migratie 0006: `lots.sale_channel` (zaal / online)

### Data — geïmporteerd + verrijkt
- ✅ Aloga 2026 collectie gescraped: 24 loten (19 springen + 5 dressuur)
- ✅ Generiek import-script: `scripts/import-lots.mjs`
- ✅ **Geïmporteerd op 30-04**: 1 auction_house (Aloga), 1 auction (Aloga Auction 2026), 24 lots
- ✅ Datum/locatie/starttijd Aloga 2026 ingevuld via REST PATCH
- ✅ **Data-enrichment 30-04** (`scripts/aloga-2026-enrich.py`): 17 lots opnieuw gescraped
  via WebFetch + DB ge-PATCHed met studbook, size, catalog_text,
  equiratings_text en photos. Resterende `missing_info` is meestal alleen
  `lot_number`, `video_url`, `reserve_price` — items die de website niet
  publiceert.

### Voorbereidingsmodule — LIVE (commits 4369975, c6a5a66, 25cc404, f01b5c1, 823cc29, 95d5441)
- ✅ Routing: react-router-dom v7 met `/`, `/houses/:id`, `/auctions/:id`, `/lots/:id`, 404
- ✅ HousesPage: lijst van veilinghuizen, klikbaar
- ✅ HousePage: veilingen voor een huis, met datum/locatie/status
- ✅ AuctionPage: 24 lots met thumbnail, lotnummer, naam, discipline + jaar +
  gender + studbook, en sire × dam — gesorteerd op nummer dan naam
- ✅ LotPage: foto-gallery (klikbare thumbnails), catalogtekst, EquiRatings-tekst,
  video-blok (placeholder als geen URL), USP/sterke/aandachtspunten als gevuld
- ✅ Auto-save notitievelden (catalogus, video, organisatie) met 800ms debounce,
  status-indicator per veld (idle / typen / opslaan / opgeslagen / fout)
- ✅ Vorig/volgend lot — klikbare links + pijltjestoetsen (← →) + indicator "X / 24"

### Prototypes (als referentie, nog niet gekoppeld aan backend)
- ✅ Fase 1 prototype: veilinghuizen → veilingen → lots → detail met video + notities
- ✅ Live dashboard prototype: scorebord voor organisatie met timing en omzet
- ✅ Timing-module: volledig gespecificeerd

### Documenten
- ✅ MASTER_PROMPT.md
- ✅ PROJECT_STATUS.md (dit document)
- ✅ DEVELOPER_SETUP.md
- ✅ Timing-module specificatie
- ✅ Masterplan v2 (volledig custom, geen Notion)

---

## Wat nog gebouwd moet worden — MVP voor 5 mei

### Eerstvolgende stappen
- [x] ~~Cockpit-statusbalk~~ — AF op 02-05-2026 (commit 24728d4):
  voortgang, omzet, gem. duur en verwacht einduur, live update na elke hamer
- [x] ~~Cockpit stap 6~~ — AF op 02-05-2026 (sessie-stats verwerkt in statusbalk)
- [x] ~~Overzichtspagina einde veiling~~ — AF op 02-05-2026 (commit 6f921c5):
  `/auctions/:id/summary` met kerncijfers + per-type + per-lot, knop verschijnt
  op cockpit zodra alle lots gehamerd zijn
- [x] ~~Vercel-deployment~~ — AF op 02-05-2026, live op https://veiling-pro.vercel.app
  (auto-deploy bij elke push, SPA-fallback via `vercel.json`)
- [x] ~~Duizendscheiding op alle bedrag-velden~~ — AF op 02-05-2026 (commit 7c9798b):
  start/reserve op LotPage, bietstappen op AuctionPage, hamer-form in cockpit
  tonen nu €15.000 ipv €15000 tijdens invoer
- [ ] **Cockpit stap 5**: notities bewerkbaar in cockpit (✏-knop per veld) — comfort
- [ ] **Klanten-UI** (0b, uitgesteld na 5 mei): autocomplete op LotPage
- [ ] **Eindtijd Aloga 2026** invullen (starttijd staat op 20:00) — REST PATCH, 30 sec
- [ ] **Drop deprecated columns** (`lots.bid_steps` text, `lots.lot_type` text)
  in schoonmaak-migratie — na 5 mei

### Dag 2-3 — Voorbereidingsmodule (✅ AF op 30-04-2026)
- [x] Veilinghuizen → Veilingen → Lots navigatie
- [x] Lot detail: paardsgegevens, video ingebed, 3 notitievelden
- [x] Navigatie vorig/volgend lot
- [x] Auto-save notities
- [x] Inline edit voor lot-nummer, startprijs, reserveprijs (commit 93bcfb6)
- [x] Datum/locatie/starttijd Aloga ingevuld (REST PATCH 30-04)
- [x] Migratie 0002: bid_steps verhuisd van lots naar auctions (commit 6112a2a)
- [x] Bug-fix: state-stale na navigeren tussen lots (commit 93bcfb6)

### Bid-step-systeem (✅ AF op 30-04-2026, commits 765215c → fd6f793)
- [x] `lot_types` referentietabel met 8 seed-types
- [x] `auction_lot_types` koppel-tabel (welke types in welke veiling)
- [x] `bid_step_rules` tabel met range_from / range_to / step
- [x] Lots gekoppeld aan lot_type via `lots.lot_type_id` FK + backfill
  (19 springpaarden → sport-jumping, 5 dressuur → sport-dressage)
- [x] AuctionPage: LotTypesSelector (checkbox-grid) + BidStepRulesEditor
  (mini-tabel per type met inline-editbare ranges en step)

### Live Cockpit (5 van 6 stappen ✅, commits 73761c5 → 6f921c5)
- [x] Stap 1: skelet `/cockpit/:auctionId` met read-only paard-info, foto-gallery,
  catalogtekst, EquiRatings, leeftijd-uit-jaar (bv. "2019/7 jaar"), klanten-
  placeholder, biedstaffel-preview
- [x] Externe links read-only in cockpit (Hippomundo / Horsetelex / Extra)
- [x] Stap 2: drie-knop-flow (IN DE PISTE → START BIEDEN → HAMER) met
  state-machine (pending/active/done), live timer per fase, "Volgend lot →"
- [x] Stap 3: hamer-form met radio (Verkocht in zaal / online / Niet verkocht),
  bedrag-invoer, Annuleer/Bevestig. Resultaat-regel toont "Verkocht in zaal —
  €X om HH:MM (duur MM:SS)"
- [ ] Stap 4: huidig-bod input — **GESCHRAPT** (Frederik typt enkel finale prijs)
- [ ] Stap 5: notities bewerkbaar in cockpit
- [x] Stap 6: sessie-statistieken (commit 24728d4 — verwerkt in CockpitStatusBar:
  X/N gehamerd, ✓ verkocht / ⊘ niet, omzet, ⌀ duur, verwacht einduur)
- [x] LotPage: LotTypeDropdown om type per lot te kiezen
- [x] LotPage: BidStepRulesPreview (read-only) voor referentie
- [x] Helper `nextBidStep(currentBid, rules)` in src/lib/bidSteps.js

### Overzichtspagina einde veiling (✅ AF op 02-05-2026, commit 6f921c5)
- [x] Nieuwe route `/auctions/:id/summary` (in App.jsx)
- [x] Kerncijfers-blok: voortgang, verkocht/niet, totale omzet,
  gem. verkoopprijs, gem. duur per lot, totale wallclock-duur
- [x] Per lot-type: aantal, verkocht/niet, gemiddelde en totaal per type
- [x] Per lot: lijst van alle 24 met resultaat (zaal/online/niet-verkocht)
  of "nog niet gehamerd" als time_hammer leeg is
- [x] Werkt ook bij lopende veiling: toont "(veiling nog bezig)" en partial
- [x] Cockpit-knop "📊 Overzicht einde veiling →" zichtbaar zodra alle
  lots gehamerd zijn (`allLots.every(l => l.time_hammer != null)`)

### Vercel-deployment (✅ AF op 02-05-2026)
- [x] Project gekoppeld aan https://github.com/frederikdbacker/Veiling-Pro
- [x] Auto-deploy bij elke push naar `main`
- [x] Environment Variables ingesteld (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`)
- [x] `vercel.json` met SPA-fallback rewrites zodat deeplinks werken
  (commit e45be77)
- [x] Live op https://veiling-pro.vercel.app

### Utilities (✅ AF op 02-05-2026)
- [x] `scripts/reset-auction.sql` — reset alle hamer-data + active_lot_id
  voor één veiling. Plak in Supabase SQL Editor en run vóór 5 mei om
  test-data uit Aloga te wissen.

### Toekomstig (na 5 mei)
- [ ] "Kopieer bid-step-staffel van vorige veiling" — bv. Aloga 2027 erft
  staffels van Aloga 2026 automatisch (Frederik's wens 30-04-2026)
- [ ] Range-overlap-validatie met visuele waarschuwing
- [ ] Drop deprecated kolommen `lots.bid_steps` (text) en `lots.lot_type` (text)

### Klanten-UI — uitgewerkte specificatie (Frederik's wens 02-05-2026)

Op LotPage een veld "Geïnteresseerden" waarin Frederik per paard namen
kan invoegen van mensen die interesse hebben getoond. Per persoon:

- **Naam**
- **Tafelnummer** (waar in de zaal)
- **Richting** (waar Frederik moet kijken — bv. "links achter", "midden")
- **Opmerking** (vrij veld)

**Slim gedrag dat hij wil:**
1. Wanneer dezelfde naam later bij een ánder paard wordt ingevuld,
   moeten **tafelnummer, richting en opmerking automatisch overgenomen
   worden** uit de eerste invoer in dezelfde veiling.
2. **Autocomplete-suggesties:** zodra Frederik begint te typen in het
   naamveld, krijgt hij een lijstje van klanten die binnen deze veiling
   al ergens anders zijn ingevoerd en met die letter(s) beginnen.

**Database:** de `clients` + `lot_interested_clients` tabellen bestaan
al (migratie 0004). De spec sluit aan: `clients.name/country/notes`
plus `lot_interested_clients.notes`. Wat nog ontbreekt:
- `clients.table_number` (text of int)
- `clients.direction` (text)
- Of beter: `lot_interested_clients.table_number/direction` als die per
  veiling kunnen verschillen (waarschijnlijk wel — een klant kan in
  verschillende veilingen op een ander tafelnummer zitten). Bij het
  bouwen overleggen welke tabel waar woont.

**Cockpit:** "Geïnteresseerde klanten"-sectie heeft nu al een placeholder
in CockpitPage; vult zich automatisch zodra de UI op LotPage data
levert via `lot_interested_clients`.

### Dag 4-5 — Live cockpit
- [ ] Minimale interface voor tijdens de veiling
- [ ] "In de piste" knop → tijdstempel
- [ ] "Hamer" knop → tijdstempel + prijsinvoer
- [ ] Live timer per lot
- [ ] Tempo-indicator (voor/achter op schema)
- [ ] Verwacht einduur
- [ ] Gebruikt automatisch de bid-staffels uit de bid_step_rules-tabel

### Dag 6 — Live dashboard
- [ ] Deelbare URL (bijv. /live/aloga-2026)
- [ ] Real-time via Supabase subscriptions
- [ ] Alle loten, prijzen, omzet, verwacht einduur

### Dag 7 — Testen
- [ ] Volledig doorlopen op tablet
- [ ] Alle 24 loten controleren
- [ ] Bugs fixen

### Dag 8 — Voorbereiding inhoud
- [ ] Video-URLs toevoegen per paard
- [ ] Eigen notities invullen

### Dag 9 (4 mei) — Buffer

---

## Wat NIET gebouwd wordt voor 5 mei

- CRM / Personen
- Historisch archief
- D-brief module
- Analyse-dashboard
- Exportfuncties

Deze onderdelen worden na de veiling gebouwd.

---

## Databaseschema (zoals geïmplementeerd in 0001_init.sql)

### `auction_houses`
id, name (unique), country, website, contact, notes, created_at

### `auctions`
id, house_id, name, date, location, status, notes,
time_auction_start, time_auction_end, created_at
Unique: (house_id, name)

### `lots`
id, auction_id, number, name, slug,
discipline, year, gender, size, studbook, sire, dam, pedigree_raw,
catalog_text, equiratings_text, photos (jsonb), video_url, source_url,
start_price, reserve_price, bid_steps,
notes_catalog, notes_video, notes_org, usp, strong_points, weak_points,
sold, sale_price, buyer, buyer_country,
time_entered_ring, time_hammer, duration_seconds,
lot_type, data_reliability, missing_info (jsonb),
created_at

---

## Bekende ontbrekende data (Aloga 2026)

- **Lotnummers**: nog niet officieel gepubliceerd door Aloga
- **Video-URLs**: dynamisch geladen, niet scrapebaar — manueel toe te voegen
- **Reserveprijzen**: niet publiek beschikbaar
- **Biedstappen**: te bepalen door veilingmeester na overleg met organisatie
- **15 paarden**: catalogustekst, EquiRatings-tekst en foto's ontbreken gedeeltelijk

---

## Design tokens (referentie voor Claude Code)

```
Achtergrond:    #0E0C09
Surface:        #161310
Card:           #1D1A14
Border:         #2A2519
Accent (goud):  #C8A96E
Tekst:          #EDE4CF
Muted:          #6E6351
Groen:          #5A8A5A
Blauw:          #6A8A9E

Fonts:
  Titels:  Cormorant Garamond (serif)
  Tekst:   DM Sans (sans-serif)
  Mono:    Geist Mono (live cockpit, cijfers)
```
