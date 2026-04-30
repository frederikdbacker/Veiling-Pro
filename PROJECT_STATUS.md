# PROJECT_STATUS — Veiling-Pro

**Laatste update: 30 april 2026**
**Deadline: 5 mei 2026 (Aloga Auction 2026)**

---

## Huidige status: VOORBEREIDINGSMODULE LIVE

Database staat (1 huis, 1 veiling, 24 lots). Hele navigatie van Veilinghuizen
→ Veiling → Lot werkt in browser, mét foto-gallery, catalog/EquiRatings-tekst,
video-blok, drie auto-save notitievelden en vorig/volgend-navigatie (klik én
pijltjestoetsen). Volgende blok is de live cockpit (Dag 4-5).

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
- ✅ SQL-migratie uitgevoerd in Supabase Dashboard (30-04-2026)
- ✅ Drie tabellen aangemaakt: `auction_houses`, `auctions`, `lots`
- ✅ RLS aan, met permissive MVP-policies (later vervangen door auth-based)
- ✅ Schema uitgebreid met de rijke velden uit de Aloga-import (foto's, catalog_text,
  equiratings_text, USP, strong/weak points, etc.)

### Data — geïmporteerd
- ✅ Aloga 2026 collectie gescraped: 24 loten (19 springen + 5 dressuur)
- ✅ JSON in `data/aloga-2026-import.json`
- ✅ Generiek import-script: `scripts/import-lots.mjs`
- ✅ **Geïmporteerd**: 1 auction_house (Aloga), 1 auction (Aloga Auction 2026),
  24 lots — geverifieerd via REST count

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
- [ ] Vercel deployment configureren
- [ ] Datum/locatie/start-tijd voor Aloga Auction 2026 invullen (handmatig in
  Supabase Table Editor, of een mini-edit-feature)

### Dag 2-3 — Voorbereidingsmodule (✅ AF op 30-04-2026)
- [x] Veilinghuizen → Veilingen → Lots navigatie
- [x] Lot detail: paardsgegevens, video ingebed, 3 notitievelden
- [x] Navigatie vorig/volgend lot
- [x] Auto-save notities

### Dag 4-5 — Live cockpit
- [ ] Minimale interface voor tijdens de veiling
- [ ] "In de piste" knop → tijdstempel
- [ ] "Hamer" knop → tijdstempel + prijsinvoer
- [ ] Live timer per lot
- [ ] Tempo-indicator (voor/achter op schema)
- [ ] Verwacht einduur

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
