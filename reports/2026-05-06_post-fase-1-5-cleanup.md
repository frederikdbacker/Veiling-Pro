# Audit — Post-fase 1.5 cleanup (variabelnamen + breadcrumbs + UI-tekst)

**Datum:** 6 mei 2026 (vijfde en laatste audit van deze marathon-sessie)
**Sessie:** Code (vanaf MacBook)
**Type:** Cosmetische opvolging na Fase 1.5 schema-rename — drie kleine
        commits

---

## Wat is er gewijzigd

### A — Variabelnamen-cleanup (commit `7bde2e6`)

Word-boundary aware perl-sweep over 17 files. JS-identifiers die in
Fase 1.5 bewust waren overgeslagen, nu wel hernoemd voor cognitieve
consistentie tussen DB-namen (`collections`) en JS-state (`collection`):
- `auctionId` → `collectionId` (URL-param namen + useParams destructures)
- `auction` → `collection` (state variable, .id/.name/.date member-access)
- `setAuction` → `setCollection`
- `auctions` → `collections` (HousePage state list)
- `setAuctions` → `setCollections`
- `auctionRes` / `auctionsRes` → `collectionRes` / `collectionsRes`

App.jsx routes meegerenamed: `/collections/:collectionId` (was nog
`:auctionId` na Fase 1.5), `/cockpit/:collectionId`. useParams() in
elke page nu `{ collectionId }`.

Niet aangeraakt: `auction_houses` (tabel), `time_auction_start` (kolom),
console.log "Auction:" (hoofdletters, niet gematched), comments met
`auction_lot_types`/etc. terminologie als historische context.

### B — Breadcrumbs (commit `143393e`)

Nieuw component `src/components/Breadcrumbs.jsx`:
- Trail-array van `{ label, to? }` objecten
- Item zonder `to` = huidige pagina (geen link, andere kleur)
- Uniforme styling: separator `›`, muted-color voor links, secondary
  voor current

Geïntegreerd op vijf pagina's:
- HousePage:               `Veilinghuizen › [House]`
- CollectionPage:          `Veilinghuizen › [House] › [Collection]`
- LotPage:                 `Veilinghuizen › [House] › [Collection] › [Lot]`
- CockpitPage:             `Veilinghuizen › [House] › [Collection] › Cockpit`
- CollectionSummaryPage:   `Veilinghuizen › [House] › [Collection] › Overzicht`

Vervangt diverse inline `<p style={crumbsStyle}>...`-blokken met
inconsistente styling. LotPage was eerder slechts 3 levels (zonder
lot-naam aan einde) — nu volledig 4 levels.

### C — UI-tekst sweep (commit `1ebcd18`)

Selectieve "veiling" → "collectie" replacement op user-facing strings
die expliciet de DB-row (nu een collection) bedoelen.

**Wel gewijzigd:**
- h1 fallback `'Veiling'` → `'Collectie'` (CollectionPage)
- "Fout bij ophalen veiling" → "Fout bij ophalen collectie"
- "Veiling niet gevonden" → "Collectie niet gevonden"
- "veiling-pagina" → "collectie-pagina" (in 2 components)
- "Lot-types in deze veiling" / "in deze veiling aanwezig" → "...collectie"
- "al gekocht in deze veiling" → "...collectie"
- "geldt voor de hele veiling" → "...collectie"
- "loskoppelen van deze veiling" / "Verwijder van deze veiling" → "...collectie"

**Bewust niet aangeraakt:**
- "tijdens de veiling" / "veiling klaar" / "veiling nog bezig" — refereert
  naar het live veiling-event, niet de DB-row
- "Veilinghuizen" / "veilinghuis" / "Veilinghuis-id" — `auction_houses`
  blijft auction_houses, dus "huizen voor veilingen" is correct
- "veilingmeester" — vakterm voor de mens die de veiling leidt
- JSDoc-comments — historische context

---

## Wat zou fout kunnen gaan

- **Mac mini desync** — als Frederik op de andere Mac werkt: `git pull`
  vóór hij iets queryt. Inmiddels is de variabelnaam-cleanup ook live,
  dus eventueel half-uitgevoerde edits op de andere kant geven nu conflicts.
- **Production blip** — niet te verwachten, code-only changes na de
  schema-rename. Build was groen vóór elke commit.
- **Cognitief mismatchpunt nog over** — comments mentioning "auction_lot_types"
  / "auction_breaks" terminologie zijn niet ge-update. Dat is bewust:
  die comments verwijzen naar de schema-naamgeving die nu
  `collection_lot_types` / `collection_breaks` is. Tweaks kan, maar
  geen functionele impact.

---

## Wat moet visueel gecontroleerd worden

1. Alle pagina's hebben nu uniforme breadcrumbs bovenaan — visueel
   testen op productie (https://veiling-pro.vercel.app):
   - `/houses/:id` → "Veilinghuizen › [House]"
   - `/collections/:id` → "Veilinghuizen › [House] › [Collection]"
   - `/lots/:id` → "Veilinghuizen › [House] › [Collection] › [Lot]"
   - `/cockpit/:id` → "Veilinghuizen › [House] › [Collection] › Cockpit"
   - `/collections/:id/summary` → "...Overzicht"
2. Geen 404 of route-fail op herladen van een pagina (nieuwe param-naam
   `:collectionId` in elke route).

---

## Hoe rollback indien nodig

Per commit: `git revert <hash>` op een specifieke commit (de drie zijn
onafhankelijk en omkeerbaar).

---

## Volgende sessie

Roadmap-resterend:
- **Fase 3** klantenbeheer (4-6u, 2 sessies) — bouwt op nieuwe naam-
  conventies van Fase 1.5
- **Fase 4** cockpit-vernieuwing (4-6u, 2 sessies)
- **Fase 5** charity-lot (2-3u)
- **Fase 6** scrape-uitbreiding (1-2u)
- **Migratie 0019** (drop deprecated notes_catalog/notes_video) wanneer
  Frederik content heeft overgezet

Sterke aanbeveling: **stop nu definitief**. Vandaag voltooid: Fase 0,
spotter-bug, pre-fase checks, Fase 1, Fase 2 (alle 6 items + bonussen),
Fase 1.5 (rename) + post-cleanup. Dat is meer dan 12 sessies werk uit de
oorspronkelijke planning, in één dag. Volgende sessie verdient een
verse start.
