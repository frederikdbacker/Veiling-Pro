# Audit — Data-imports + UI-batch

**Datum:** 7 mei 2026
**Sessie:** Code
**Type:** Scraping/imports + UI-aanpassingen + style-consistentie

---

## Context

Vandaag een gemengde sessie: bouw van scrapers voor zes externe veilingplatformen,
import van ~10.500 paarden, plus tientallen UI-fixes en stijlcorrecties.

---

## Data-imports

### Aloga 2025
- Nieuwe Puppeteer-scraper `scrape-weauction.mjs` voor het weauction.nl
  Angular-SPA-platform.
- 24 lots geïmporteerd (22 met volledige stamboomdata via subtitle-pattern
  "year I gender I sire x dam").
- Duplicate Aloga-house gemerged (`scripts/merge-aloga.mjs`).

### Aloga team
- 6 personen (4 Showjumping + 2 Dressage) met foto's via
  `scripts/import-aloga-team.mjs` in `house_committee_members`.
- Foto-URLs direct extern gekoppeld (Supabase Storage RLS blokkeerde upload;
  externe URLs werken prima en zijn pragmatisch).

### Fences (Agence Fences)
- 13 associés gescraped via Puppeteer (`scripts/import-fences-associes.mjs`).
- Volledige veilinghistorie 1998–2025 via 4D-API
  (`/wp-content/themes/Divi-child/4D-integrator/get-4D-Data-ajax.php`):
  271 collecties, 9.946 lots geïmporteerd.
- 4 toekomstige veilingen 2026 (Deauville Sélection, Deauville Classic,
  Élite, Service) als planned-collecties.

### Hannoveraner Verband
- 7 OnLive-veilingen 2026 (YoungSTARS, Elite-Foal, Championship,
  143rd Elite-Auction ×2, Stallion Licensing Dressage + Jumping).

### weauction.nl-platform — overige tenants
- WEF Sporthorse Auction (VDL Stud): 6 collecties, 78 lots
- Swedish Warmblood Association: 2 collecties, 63 lots
- De Wolden Summer Sale: 3 collecties, 64 lots
- Woodlands International Sales: +2 oude collecties (2020+2021), 50 lots
- Generieke `scrape-weauction-tenant.mjs` orkestrator: leest
  `/api/auctions/publishedByTenant` (gesnift via Puppeteer) en draait
  per auction `scrape-weauction.mjs`.

### Data-correcties
- Zangersheide: 8 Friday/Saturday Foals-collecties → lottype "Veulen"
  (329 lots) via `fix-zangersheide-foals.mjs`.
- Zangersheide: `start_price` → `sale_price` (398 lots, sold=true) want
  het waren feitelijk verkoopprijzen — `fix-zangersheide-prices.mjs`.
- Alle veilingen met datum < vandaag op status="afgesloten"
  (1 collectie geüpdatet) — `mark-past-collections-finished.mjs`.

---

## UI-aanpassingen

### LotPage
- Charity-checkbox verplaatst van "Lot & prijzen"-blok naar eigen blok
  helemaal onderaan (na alle notities).
- "EquiRatings-tekst"-placeholder vervangen door
  "vul hier je beschrijving in." via nieuwe prop `placeholderText` op
  `EditableLongText`.
- Lottype-dropdown: ✨-melding "automatisch toegekend, klik om te wijzigen"
  weggehaald (gebruiker zag het als ruis).

### CollectionPage
- Inline-knop "🐎 + Lot toevoegen" naast "+ Pauze toevoegen", met
  inline-form + Enter-shortcut.
- "Bewerk veiling-metadata" knop verplaatst naar dezelfde regel als
  datum/locatie/status/aantal-loten.
- `LotTypesSelector` heeft nu een `compact`-prop: knop in de actionRow
  naast Bulk startbedrag en Klanten, dropdown-paneel onder de knop.
- Sorteerfunctie: 3 togglebuttons → 1 dropdown
  (Lotnummer / A-Z / ★ Rating).

### HousesPage
- Lijst → 3-koloms grid met logo-cards (logo, naam, geen land).

### HousePage
- Logo + naam + bewerk-knop op dezelfde regel.
- Telling + zoekbalk op dezelfde regel.
- Comitéleden onderaan, na de veilingenlijst.
- Nieuw: "🏆 Duurste verkoop"-badge met naam, prijs en jaar
  (gebaseerd op alle sold lots ≠ charity).
- **Bugfix lot-zoek**: PGRST201-error door dubbele FK tussen lots ↔
  collections (collection_id + active_lot_id). Opgelost met
  `collections!lots_auction_id_fkey!inner(...)`.

### CollectionSummaryPage
- Volledig op design-tokens gezet (alle hardcoded `#fff/#fafafa/#eee/
  #666/#888/#aaa/#999/#222/#333/#555/#5A8A5A/#a06010` → `var(--bg-elevated)`,
  `var(--text-primary/secondary/muted)`, `var(--success/warning)`,
  `var(--border-default)`).
- Geïmporteerde verkoopsprijzen meetellen: `sold` filter is nu
  `sold===true && sale_price!=null` (niet meer afhankelijk van time_hammer).
- EmptyState verschijnt niet meer als er geïmporteerde verkopen zijn.
- Nieuwe header-tag "(geïmporteerde resultaten)" voor afgesloten,
  niet-live veilingen; "Voortgang gehamerd"-rij verborgen voor isImported.

### ClientsPage
- Dubbele vlag-bug opgelost: aparte `<span>` met flag-emoji verwijderd,
  CountrySelect toont vlag al in zijn options.

### Globale stijlconsistentie
- BuyerAutocomplete: witte achtergrond → `var(--bg-card)`.
- HousePage logo-img preview: witte achtergrond → `var(--bg-elevated)`.
- LogoLink (in cockpit) bewust wit gehouden voor logo-zichtbaarheid.

---

## Wat kan fout gaan / risico's

1. **Lot-zoek**: nu via FK-naam `lots_auction_id_fkey` gebonden. Als die FK
   ooit hernoemd wordt, breekt de zoekfunctie. Foutmelding zou duidelijk zijn
   (PGRST201 met hint).
2. **`sale_price` filter in summary**: lots met sold=true maar sale_price=null
   tellen niet mee. Als import-scripts ooit sold=true zetten zonder prijs,
   verdwijnen die uit de stats. Nu is dat niet het geval.
3. **Externe foto-URLs voor team**: aloga-auction.com kan zijn URLs wijzigen.
   Foto's worden dan kapotte links. Beter ware Storage-upload, maar RLS
   blokkeert dat onder anon-key. Niet dringend.
4. **Fences past auctions**: 9.946 lots zonder pedigree — geen sire/dam in
   de meeste gevallen, alleen voor lots met ingevulde Nom_pere/Nom_mere.
   Bijwerken via Hippomundo/Horse Telex automatisch is geblokkeerd door
   Cloudflare; quick-link niet gebouwd, eerste alternatief is een betaalde
   API-route via Hippomundo of manueel via plak-en-parse veld.
5. **weauction.nl tenant API**: privé endpoint, kan zonder waarschuwing
   wijzigen. Bij breken: probe-network opnieuw draaien om de nieuwe URL
   te vinden.

## Wat visueel checken

- HousesPage: 3-koloms grid, logo's tonen waar `logo_url` is ingevuld.
- HousePage van Aloga: comitéfoto's zichtbaar, "🏆 Duurste verkoop"-badge.
- HousePage van Fences: comité 13 personen, zoekbalk werkt op lot-namen.
- CollectionPage van een Zangersheide-veulenveiling: lots tonen "Veulen"
  als type.
- CollectionSummaryPage van Zangersheide Stallion Auction 2026: omzet
  €1.087.000 en 18 verkochte lots zichtbaar.
- LotPage van een lot met `equiratings_text == null`: placeholder toont
  "vul hier je beschrijving in." (zonder "de" prefix).
- LotPage scroll: charity-checkbox onderaan in eigen blok.
- CollectionPage: sorteer-dropdown ipv 3 knoppen, "🏷 Lot-types (X)"-knop
  naast Bulk startbedrag.

## Hoe rollback

- Code-wijzigingen: `git restore` per bestand, of `git revert <commit>`.
- Geïmporteerde data: scripts zijn idempotent (upsert op natuurlijke key).
  Verwijderen via Supabase SQL:
  - WEF: `delete from collections where house_id = (select id from auction_houses where name='WEF Sporthorse Auction powered by VDL Stud');` (cascadeert naar lots)
  - Idem voor SWB, De Wolden, oude Woodlands, Fences, Hannoveraner.
- Zangersheide foal-fix: `update lots set lot_type_id = null where collection_id in (...)`.
- Zangersheide prices-fix: `update lots set start_price = sale_price, sale_price = null, sold = false where ...`. Een DB-backup vóór die migratie was wenselijk maar is overgeslagen — dit is een aandachtspunt voor toekomstige bulk-updates.

---

## Wijzigingen op kerndocumenten

`PROJECT_STATUS.md` en `MASTER_PROMPT.md` apart bijwerken in dezelfde commit.
