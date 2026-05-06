# PROJECT_STATUS — Veiling-Pro

**Laatste update: 6 mei 2026 (Fase 0 iteratie)**
**Aloga Auction 2026 voorbij — iteratie volgens POST_ALOGA_ROADMAP.md gestart**

---

> **6 mei 2026 — ALLE FASES VAN POST_ALOGA_ROADMAP.md AF.**
> In deze ene marathon-sessie voltooid: Fase 0 (iCloud→git), spotter-bug
> (migratie 0010), pre-fase Supabase-checks, Fase 1 (5 quick wins),
> Fase 1.5 (rename auctions→collections, 12+ files), Fase 2 (6 items
> incl. rich-text-editor en notitievelden-herstructurering), Fase 3
> (7 items klantenbeheer + globale ClientsPage + foto-upload), Fase 4
> (5 items cockpit-vernieuwing incl. één VERKOCHT-knop, sticky infobar,
> rundown, veilingvolgorde drag-and-drop), Fase 5 (charity-lot),
> Fase 6 (scrape source_url → url_extra).
>
> Productie-migraties uitgevoerd: 0010, 0013–0022 (12 stuks).
> Audit-rapporten in `reports/2026-05-06_*.md` (6 stuks).
>
> De "Huidige status"-sectie hieronder is van 2 mei (pre-Aloga). Voor
> de post-Aloga reality, zie de zes audit-rapporten en de roadmap-doc.

## Huidige status: REDESIGN-MARATHON KLAAR — DONKER THEMA + 8 MODULES LIVE

Acht modules werken end-to-end op productie (https://veiling-pro.vercel.app):

1. **Voorbereidingsmodule** — Veilinghuizen → Veilingen → Lots → Detail.
   LotPage volledig herwerkt 02-05: klein klikbaar thumbnail (geen grote
   foto), volgorde Lot & prijzen → Pedigree → Externe links → Catalog →
   EquiRatings → Video → optionals → klanten → notities. Catalog en
   EquiRatings nu bewerkbaar via ✏-icoon (EditableLongText) als de
   scrape niets vond.
2. **Bid-step-systeem** — staffels per (veiling, type) met datalist-
   presets [5.000, 10.000, 20.000, 25.000, 50.000, 100.000, 500.000,
   1.000.000] op range-grenzen en [100, 200, 500, 1.000, 2.000, 5.000,
   10.000, 25.000] op steps. Biedstappen-editor staat onderaan
   AuctionPage, ingeklapte lot-types selector erboven.
3. **Live Cockpit** (alle 6 stappen af) — `/cockpit/:auctionId` met
   compacte paardidentiteit (klein thumbnail), klapbare cards
   (Geïnteresseerden, Catalogustekst, Mijn voorbereiding), pedigree-
   bracket-tree binnen de lot-card, statusbalk + sessie-stats, drie-
   knop-flow + Vorig/Volgend in picker, hamer-modal met koper-
   autocomplete, spotters-strip tussen statusbalk en lot-picker.
4. **Overzichtspagina einde veiling** — `/auctions/:id/summary`
   (ongewijzigd t.o.v. vorige sessie).
5. **Klanten-UI** — geïnteresseerden per paard met seating, autocomplete
   over hele huis, "al gekocht"-indicator. ✏-bewerk en ✕-verwijder per
   klant-rij.
6. **Pedigree** — bracket-tree op LotPage en cockpit, 3 generaties
   (ouders/grootouders/overgrootouders). Witte tekst op transparante
   kaders, geen kleur per kant. Alle 24 Aloga-lots geïmporteerd uit
   aloga-auction.com via WebFetch + scripts/import-pedigree.mjs.
7. **Spotters** — globale tabel + junction. AuctionPage onderaan toont
   slot-dropdown (0-15) met N rijen waarin Frederik namen invoert via
   autocomplete (over alle eerder ingevoerde spotters). Cockpit toont
   compacte strip 👥 tussen statusbalk en lot-picker, links→rechts
   gesorteerd.
8. **Pauzes (BIS-blokken) + sorteer-toggle + online-toggle** —
   AuctionPage heeft sorteer-toggle (Lotnummer / A-Z), pauzes met
   automatisch BIS-label, drag-and-drop tussen lots via @dnd-kit,
   bewerken + verwijderen inline. Action-row bovenaan: 🎬 Cockpit, 📊
   Overzicht (link naar summary-pagina), 📋 Link kopiëren (clipboard),
   en checkbox "Online biedingen actief" die de "Verkocht online"-
   optie in de cockpit hamer-modal verbergt of toont.

**Donker thema** is volledig doorgevoerd (CSS-variabelen in `index.css`):
neutraal donkergrijs (#1A1A1A) base, witte tekst (#F0F0F0), standaard
groen (#22C55E) accent, standaard rood (#EF4444) voor warning/danger.
Geen goud meer, geen Aloga-getinte kleuren — bewust generiek.

Vercel-deploy auto-bij elke push. Database-stand: migraties 0001 t/m
0012 actief (0009 wordt overgeslagen want 0010 dropt en herstelt
spotters-schema). Eindtijd 22:48 (raming op 7 min/lot). 24 lots met
enriched data + pedigree.

Open vóór 5 mei: iPad-test (visueel) en reset-data via
`scripts/reset-auction.sql`. Cockpit is volledig bruikbaar op iPad
via de gepubliceerde URL.

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
- [x] ~~Klanten-UI~~ — AF op 02-05-2026 (commit e912161):
  geïnteresseerden + tafel/richting/opmerking per veiling, autocomplete
  binnen huis, auto-overname bij hertypen, koper-veld in cockpit met
  geïnteresseerden eerst (★), "✓ al gekocht"-indicator
- [x] ~~Eindtijd Aloga 2026~~ — AF op 02-05-2026 (geschat einde 22:48 op
  basis van 7 min/lot)
- [x] ~~Cockpit stap 5~~ — AF op 02-05-2026 (commit 5e5f982): notities
  bewerkbaar in cockpit via auto-save NoteFields onder "Mijn voorbereiding"
- [x] ~~Donker thema redesign~~ — AF op 02-05-2026: CSS-variabelen,
  generieke kleuren wit/groen/rood/grijs, alle pagina's getokeniseerd
- [x] ~~Pedigree~~ — AF op 02-05-2026 (commit b6ec02e): bracket-tree op
  LotPage en cockpit, alle 24 Aloga-lots gescraped en geïmporteerd
- [x] ~~Spotters~~ — AF op 02-05-2026 (commit d393025): globale tabel +
  junction, slot-dropdown op AuctionPage, autocomplete, cockpit-strip
- [x] ~~Klant bewerken in UI~~ — AF op 02-05-2026 (commit 5e5f982):
  ✏-bewerk-knop per klant-rij in InterestedClientsField
- [x] ~~Edit-icoon catalogtekst/EquiRatings~~ — AF op 02-05-2026
  (commit fd226d8): EditableLongText component met read-only + ✏-knop
- [ ] **iPad-test**: cockpit doorlopen op tablet, knopgrootte +
  leesbaarheid in échte landscape-modus
- [ ] **Reset productie-data** vóór 5 mei: `scripts/reset-auction.sql`
  in Supabase (sectie 4 voor test-klanten); plus migraties 0009 en 0010
  zijn destructive voor spotters-data — opnieuw invoeren indien nodig
- [x] ~~**Frederik moet nog migratie 0010 runnen** in Supabase voor
  globale spotters (vervangt 0009)~~ — AF op 06-05-2026 (gerund tijdens
  iteratie-sessie; spotter-toevoegen-bug verholpen)
- [ ] **Drop deprecated columns** (`lots.bid_steps` text, `lots.lot_type`
  text, `lots.buyer` text) — na 5 mei

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
- [x] Stap 5: notities bewerkbaar in cockpit (commit 5e5f982 — auto-save
  NoteFields onder "Mijn voorbereiding")
- [x] Stap 6: sessie-statistieken (commit 24728d4 — verwerkt in CockpitStatusBar:
  X/N gehamerd, ✓ verkocht / ⊘ niet, omzet, ⌀ duur, verwacht einduur)
- [x] LotPage: LotTypeDropdown (nu inline naast prijzen — commit 810eb7d)
- [x] BidStepRulesPreview verwijderd uit LotPage; alleen op cockpit
  zichtbaar binnen het actie-kader (commit 810eb7d)
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
  voor één veiling. Sectie 4 (uit-gecomment) wist ook alle Aloga-klanten
  inclusief seating en lot-koppelingen via cascade.

### Klanten-UI met seating en koper-tracking (✅ AF op 02-05-2026, commit e912161)
- [x] **Migratie 0007** (additief): `clients.house_id` (klant ↔ huis),
  `client_auction_seating` (tafel/richting/opmerking per veiling),
  `lots.buyer_client_id` (koper als clients-koppeling)
- [x] `src/lib/clients.js` — helpers voor zoeken, aanmaken, seating,
  koppeling, en aankoop-aggregatie
- [x] `InterestedClientsField` op LotPage — uitklap-form met autocomplete
  binnen het huis, auto-overname van seating uit eerdere koppeling in
  dezelfde veiling, lijst met tafel/richting/opmerking/lot-specifieke
  notitie en "✓ al gekocht: #X"-indicator
- [x] `BuyerAutocomplete` in cockpit hamer-form — geïnteresseerden van
  dit lot bovenaan met ★, andere huis-klanten daaronder, leeg toegestaan,
  vrij invoeren creëert nieuwe klant
- [x] Cockpit geïnteresseerden-sectie toont nu tafel/richting/seating-
  opmerking + "al gekocht"-indicator (consistent met LotPage)

### Pedigree (✅ AF op 02-05-2026)
- [x] Migratie 0008: `lots.pedigree` jsonb voor 3-generatie tree
- [x] `PedigreeTree` component — 3 kolommen × 8 rijen via CSS-grid,
  bracket-uitlijning, witte tekst op transparante kaders met dunne rand,
  klein lettertype + small caps (compact i.p.v. visueel zwaar)
- [x] Plek: in lot-card identity-kolom op cockpit (onder basisinfo,
  vult vrije ruimte naast actie-kader); op LotPage onder Pedigree-blok
- [x] Alle 24 Aloga-lots gescraped van aloga-auction.com via WebFetch +
  geïmporteerd via `scripts/import-pedigree.mjs` uit
  `data/aloga-2026-pedigree.json`

### Donker thema design-systeem (✅ AF op 02-05-2026)
- [x] CSS-variabelen in `src/index.css`: alle kleuren, fonts, spacing,
  radius gecentreerd zodat tweaks op één plek doorwerken
- [x] Generieke kleuren wit/groen/rood/grijs (geen Aloga-getinte tints):
  bg-base #1A1A1A, text-primary #F0F0F0, accent #22C55E, danger #EF4444
- [x] Systeemfont (San Francisco / Segoe UI) + system-mono voor cijfers;
  geen webfonts geladen
- [x] Donkere scrollbars, focus-rings in goudaccent, native form-inputs
  via globale CSS naar donker thema
- [x] Alle pagina-componenten getokeniseerd: HousesPage, HousePage,
  AuctionPage, LotPage, AuctionSummaryPage, CockpitPage, plus
  InterestedClientsField, AutoSaveNumber, AutoSaveUrl, BidStepRulesEditor,
  BidStepRulesPreview, LotTypesSelector, LotTypeDropdown, NoteField,
  PedigreeTree, SpottersField, SpottersStrip, EditableLongText, Modal,
  CockpitStatusBar, BuyerAutocomplete

### Spotters (✅ AF op 02-05-2026)
- [x] Migratie 0009 → vervangen door 0010: globale `spotters`-tabel +
  `auction_spotters` junction (location en display_order per veiling)
- [x] `src/lib/spotters.js`: get / search / create / update / assign /
  unassign / updateAssignment / swapOrder
- [x] `SpottersField` op AuctionPage onderaan: slot-dropdown (0-15),
  rijen vullen automatisch, autocomplete uit globale spotters,
  ↑/↓ herorderen, ✕ unassign (globale spotter blijft)
- [x] `SpottersStrip` op cockpit tussen statusbalk en lot-picker:
  compacte 👥 + namen, links→rechts, hover toont locatie

### Pauzes + sorteer + online-toggle + summary-link (✅ AF op 02-05-2026)
- [x] Migratie 0011: `auction_breaks` tabel met `after_lot_number`,
  `title` (default "Pauze"), `description`, `duration_minutes`
- [x] Migratie 0012: `auctions.online_bidding_enabled` (bool, default false)
- [x] `src/lib/breaks.js`: get / create / update / delete helpers
- [x] AuctionPage uitgebreid met:
  - Sorteer-toggle (commit 2e11d99): # Lotnummer ↔ A-Z naam, actieve
    modus accent-groen
  - Pauzes (commit 2e11d99): "+ Pauze toevoegen" inline-form, BIS-label
    automatisch (`${after_lot_number} BIS`), bewerken + verwijderen,
    pauzes ingevoegd in lots-lijst bij Lotnummer-sortering, los onderaan
    bij A-Z
  - Drag-and-drop pauzes (commit ba12d3b): @dnd-kit/core +
    @dnd-kit/sortable + @dnd-kit/utilities geïnstalleerd. Pauzes hebben
    een ⠿-handle, lots zijn niet sleepbaar maar wel drop-target. Bij
    drop wordt nieuwe `after_lot_number` automatisch berekend.
  - Online biedingen-toggle (commit bb9e556): checkbox in action-row,
    direct DB-patch, hamer-form in cockpit verbergt "Verkocht online"
    radio-optie als toggle uit staat
  - 📊 Overzicht-knop (link naar summary) en 📋 Link kopiëren
    (clipboard-write naar `${origin}/auctions/{id}/summary`) met
    "✓ Link gekopieerd"-feedback (2.5 sec)

### Toekomstig (na 5 mei)
- [ ] "Kopieer bid-step-staffel van vorige veiling" — bv. Aloga 2027 erft
  staffels van Aloga 2026 automatisch (Frederik's wens 30-04-2026)
- [ ] Range-overlap-validatie met visuele waarschuwing
- [ ] Drop deprecated kolommen `lots.bid_steps` (text), `lots.lot_type`
  (text), `lots.buyer` (text — vervangen door `buyer_client_id`)
- [ ] Foto-upload voor spotters via Supabase Storage (nu via URL-veld)
- [ ] Klanten-overzichtspagina (alle klanten van het huis op één plek)

### Klanten-UI scope-definitie (Frederik's wens 02-05-2026)

Voor referentie — dit is wat is gebouwd in commit e912161:

- **Per geïnteresseerde**: naam, tafelnummer, richting, vrije opmerking
  (hele veiling), én optioneel een paard-specifieke notitie.
- **Klant hoort bij het huis** (`clients.house_id`) zodat dezelfde naam
  in een latere veiling van hetzelfde huis hergebruikt kan worden via
  autocomplete.
- **Tafel/richting per veiling** (`client_auction_seating`): Janssens
  kan in 2026 op tafel 12 zitten en in 2027 op tafel 5.
- **Auto-overname** bij herselecteren binnen dezelfde veiling: tafel/
  richting/opmerking worden automatisch ingevuld uit eerdere koppeling.
- **Koper-veld** in cockpit hamer-form: leeg / nieuwe naam / kies uit
  geïnteresseerden van dit lot. Resulteert in `lots.buyer_client_id`.
- **"Al gekocht"-indicator**: bij elke geïnteresseerde wordt getoond of
  die persoon al iets heeft gekocht in deze veiling, met lot-nummer en
  paardennaam.

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
