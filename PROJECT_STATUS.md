# PROJECT_STATUS — Veiling-Pro

**Laatste update: april 2026**
**Deadline: 5 mei 2026 (Aloga Auction 2026)**

---

## Huidige status: FUNDAMENT IN OPBOUW

De architectuur is beslist, de data is klaar, de repo staat. Claude Code is de volgende stap.

---

## Wat klaar is

### Architectuur & beslissingen
- ✅ Stack beslist: React (Vite) + Supabase + Vercel
- ✅ Geen Notion, geen externe platforms — volledig custom
- ✅ GitHub repo aangemaakt: https://github.com/frederikdbacker/Veiling-Pro
- ✅ Supabase project aangemaakt: https://cjxtwzmryrpwoydrqqil.supabase.co

### Data
- ✅ Aloga 2026 collectie gescraped: 24 loten (19 springen + 5 dressuur)
- ✅ Import JSON klaar: `aloga-2026-import.json`
- ✅ Import script klaar: `aloga-import-script.js`

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

### Dag 1 (vandaag)
- [ ] Supabase tabellen aanmaken (auction_houses, auctions, lots)
- [ ] Aloga 2026 data importeren (24 loten)
- [ ] Vite-project opzetten en koppelen aan Supabase
- [ ] Vercel deployment configureren

### Dag 2-3 — Voorbereidingsmodule
- [ ] Veilinghuizen → Veilingen → Lots navigatie
- [ ] Lot detail: paardsgegevens, video ingebed, 3 notitievelden
- [ ] Navigatie vorig/volgend lot
- [ ] Auto-save notities

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

## Databaseschema (te bouwen)

### `auction_houses`
id, name, country, website, contact, notes, created_at

### `auctions`
id, house_id, name, date, location, status, notes, time_auction_start, time_auction_end, created_at

### `lots`
id, auction_id, number, name, discipline, lot_type, year, gender, studbook, sire, dam, video_url, photos, catalog_text, equiratings_text, notes_catalog, notes_video, notes_org, usp, strong_points, weak_points, start_price, reserve_price, bid_steps, sold, sale_price, buyer, buyer_country, time_entered_ring, time_hammer, duration_seconds, source_url, data_reliability, missing_info, created_at

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
