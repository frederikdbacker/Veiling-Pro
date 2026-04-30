# PROJECT_STATUS — Veiling-Pro

**Laatste update: 30 april 2026**
**Deadline: 5 mei 2026 (Aloga Auction 2026)**

---

## Huidige status: COCKPIT LIVE (op één detail na)

Drie modules werken end-to-end:
1. **Voorbereidingsmodule** — Veilinghuizen → Veilingen → Lots → Detail
   met foto-gallery, catalog/EquiRatings, video, drie auto-save notes,
   inline edit voor lot-nummer/startprijs/reserveprijs, drie URL-velden
   (Hippomundo/Horsetelex/extra), vorig/volgend met pijltjestoetsen.
2. **Bid-step-systeem** — per veiling welke lot-types, per (veiling, type)
   een staffel met ranges + steps, lot-type per paard, read-only preview
   op LotPage, `nextBidStep` helper voor cockpit-lookup.
3. **Live Cockpit** (3 van 6 stappen af) — `/cockpit/:auctionId` met
   read-only paard-info (incl. catalog, EquiRatings, foto-gallery,
   leeftijd-uit-jaar, externe links), drie-knop-flow (IN DE PISTE → START
   BIEDEN → HAMER) met live timer en next-lot-knop, en hamer-form met
   verkocht-in-zaal / verkocht-online / niet-verkocht + prijs-invoer.

Database staat (1 huis, 1 veiling met datum+locatie+starttijd, 24 lots
met enriched data van aloga-auction.com, 8 lot-types, 0+ bid_step_rules,
clients-tabel klaar maar leeg).

Open: cockpit-stap 6 (sessie-statistieken — gem. duur, verwacht einduur),
klanten-UI (0b uit oorspronkelijk plan), Vercel-deploy, drop deprecated
columns. Cockpit is **bruikbaar zonder die laatste stap** — Frederik kan
op 5 mei werken.

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
- [ ] **Cockpit-statusbalk** (toegevoegd 30-04): bovenaan/onderaan altijd zichtbaar:
  "X/24 lots · Y verkocht · Z niet verkocht · Voorlopige omzet €N"
- [ ] **Cockpit stap 6**: sessie-statistieken (gem. duur per lot, verwacht einduur,
  gestart-tijdstip) — kan in dezelfde balk verwerkt worden
- [ ] **Overzichtspagina einde veiling** (toegevoegd 30-04): nieuwe route
  `/auctions/:id/summary` of `/auctions/:id/result` met:
  * Lijst van alle paarden met verkoopprijs en sold/niet-verkocht
  * Totale omzet
  * Gemiddelde prijs per lot-type
  * Gemiddelde prijs per paard (over verkochte lots)
  Knop "Overzicht openen" verschijnt op cockpit zodra alle 24 paarden gehamerd zijn.
- [ ] **Cockpit stap 5**: notities bewerkbaar maken in cockpit (kleine ✏-knop per veld)
- [ ] **Klanten-UI** (0b, uitgesteld): autocomplete op LotPage om klanten te koppelen aan paarden
- [ ] **Vercel-deployment** zodat cockpit ook op iPad/telefoon bruikbaar is
- [ ] **Eindtijd Aloga 2026** invullen (starttijd staat op 20:00)
- [ ] **Drop deprecated columns** (`lots.bid_steps` text, `lots.lot_type` text) in een schoonmaak-migratie

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

### Live Cockpit (3 van 6 stappen ✅, commits 73761c5 → c1a8677)
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
- [ ] Stap 6: sessie-statistieken
- [x] LotPage: LotTypeDropdown om type per lot te kiezen
- [x] LotPage: BidStepRulesPreview (read-only) voor referentie
- [x] Helper `nextBidStep(currentBid, rules)` in src/lib/bidSteps.js

### Toekomstig (na 5 mei)
- [ ] "Kopieer bid-step-staffel van vorige veiling" — bv. Aloga 2027 erft
  staffels van Aloga 2026 automatisch (Frederik's wens 30-04-2026)
- [ ] Range-overlap-validatie met visuele waarschuwing
- [ ] Drop deprecated kolommen `lots.bid_steps` (text) en `lots.lot_type` (text)

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
