# Audit — Donker thema redesign + pedigree + spotters + LotPage rework

**Datum:** 2 mei 2026 (latere sessie van dezelfde dag)
**Sessie:** Code (vanaf MacBook), Mac Mini niet gebruikt
**Type:** Grote redesign-marathon — design-systeem, twee nieuwe features
(pedigree + spotters), LotPage volledige herwerking, talloze UX-tweaks

---

## Wat is er gewijzigd in deze sessie

### Design-systeem (fase A van het redesign-voorstel)

- **`src/index.css`** — CSS-variabelen voor alle tokens:
  - Achtergronden: `--bg-base #1A1A1A`, `--bg-surface`, `--bg-elevated`, `--bg-input`
  - Tekst: `--text-primary #F0F0F0`, `--text-secondary`, `--text-muted`
  - Accent: `--accent #22C55E` (Tailwind green-500), `--accent-hover`, `--accent-muted`
  - Semantisch: `--success` (groen), `--warning` + `--danger` (rood `#EF4444`), `--info` (grijs)
  - Borders, spacing-schaal, radius, shadow-tokens
- **Generieke kleuren** — bewust zonder Aloga-tinten of goud, alleen
  wit/groen/rood/grijs zoals Frederik vroeg
- **Systeemfont** (San Francisco / Segoe UI) + system-mono voor cijfers,
  geen webfont-downloads
- **Donker thema toegepast op alle pagina's** — hardcoded `#222`/`#666`/
  `#fff` etc. vervangen door tokens in: HousesPage, HousePage,
  AuctionPage, LotPage, AuctionSummaryPage, CockpitPage, alle componenten
- **Body-default in `index.css`**: form-inputs, links, focus-rings,
  scrollbars, selectie-kleur — alles consistent donker
- **`<meta name="color-scheme" content="dark">`** + theme-color in
  `index.html` voor browser-UI integratie

### Pedigree-feature (commit b6ec02e)

- **Migratie 0008**: `lots.pedigree` jsonb (3-generatie nested tree)
- **`PedigreeTree` component**: bracket-layout via CSS-grid (3 kolommen ×
  8 rijen, span-N voor generatie-uitsplitsing). Witte tekst op
  transparante kaders met dunne rand, klein lettertype + small caps
- **Scrape-pipeline**: WebFetch op `aloga-auction.com/horse-details/{slug}`
  voor alle 24 lots, JSON in `data/aloga-2026-pedigree.json`,
  `scripts/import-pedigree.mjs` patcht via Supabase REST API
- **Plek**: in cockpit binnen lot-card identity-kolom (vult vrije ruimte
  naast actie-kader); op LotPage als eigen Pedigree-blok onder Lot &
  prijzen
- **Sire × dam-regel verwijderd** uit cockpit én LotPage (was redundant
  met de tree)

### Spotters-feature (commits 15f469e + d393025)

- **Eerste poging migratie 0009**: per-veiling spotters tabel
- **Tweede poging migratie 0010** (vervangt 0009 — destructive):
  globale `spotters` + `auction_spotters` junction. Spotters hergebruikt
  over meerdere veilinghuizen; tafelnummer/locatie en display_order per
  veiling
- **`src/lib/spotters.js`**: get / search / create / update / assign /
  unassign / updateAssignment / swapOrder
- **`SpottersField` op AuctionPage**:
  - Slot-dropdown (0/1/2/.../15) bovenaan
  - Bestaande toewijzingen vullen eerste rijen, lege slots staan onderaan
  - Lege slot: name-input met **autocomplete over alle globale spotters**;
    selecteer bestaande of typ nieuwe (Enter creëert globale rij + assignt)
  - Per rij: foto-thumb 40×40 (fallback 👤), naam, locatie, foto-URL,
    ↑/↓ herorderen, ✕ unassign (globale spotter blijft staan)
- **`SpottersStrip` op cockpit** tussen statusbalk en lot-picker:
  compacte regel 👥 + namen gescheiden door middelpunten, hover toont
  locatie, optioneel foto-thumbnail 20×20

### LotPage volledige rewrite (commit fd226d8 + 810eb7d)

Nieuwe volgorde per Frederiks specificatie:
1. Breadcrumb
2. Missing info banner (donker thema, warning-kleur)
3. Header: klein klikbaar thumbnail (96×96) → fotomodal bij klik
   **Geen grote foto meer** in default-view
4. Lot & prijzen: lot-nummer · startprijs · reserveprijs · lot-type
   (allemaal op één rij, alignItems flex-end)
5. Pedigree
6. Externe links: Hippomundo · Horsetelex · Extra (compact-modus,
   drie naast elkaar in flex-row)
7. Catalogustekst (`EditableLongText` met ✏)
8. EquiRatings (`EditableLongText` met ✏)
9. Video
10. USP / sterke / aandachtspunten (optioneel)
11. Geïnteresseerden (`InterestedClientsField`)
12. Mijn notities
13. Vorig/volgend nav

- **`EditableLongText` component**: read-only display + ✏-knop opent
  textarea met auto-save. Toont automatisch in edit-modus als waarde
  leeg is (handig wanneer scrape niets vond)
- **`Modal` component** geëxtraheerd voor hergebruik tussen LotPage
  fotogalerij en CockpitPage hamer-form
- **Biedstap-preview verwijderd** van LotPage (zit op cockpit binnen
  het actie-kader)
- **LotTypeDropdown inline** naast prijzen (niet meer in eigen blok)

### CockpitPage redesign (commits 040bfc2 → eee8b24 → 312bc17 → 734bdd1)

- **Twee-koloms lot-card**: identity links (thumb + naam + meta), actie-
  kader rechts (prijzen → biedstappen → timer + 3-knop-flow). Per
  Frederiks wens "alles wat tijdens veilen samenhoort fysiek bij elkaar"
- **Pedigree binnen lot-card** — onder de basisinformatie, vult de
  vrije ruimte naast het actie-kader
- **Drie-knop-flow compact** op één regel
- **Hamer-form als modal-overlay** met radio + prijs + koper-autocomplete
- **Vorig + Volgend lot in picker-balk** — naast de dropdown ipv binnen
  CockpitControls
- **Cards klapbaar** (Geïnteresseerden, Catalogustekst, Mijn voorbereiding)
  via `<details>`/`<summary>` met defaultOpen
- **Cockpit-dropdown verrijkt** met jaar/leeftijd · gender · studbook ·
  size achter elke lotnaam (paardennaam-h2 weg uit lot-card omdat al
  in dropdown)
- **VEILING PRO header geschrapt** uit App.jsx (nam ruimte zonder functie)

### AuctionPage rework

- **Volgorde**: lot-types-selector ingeklapt → lots-lijst → biedstappen
  onderaan → spotters helemaal onderaan
- **Paardennamen wit** (text-primary), thumb-placeholders donker
- **"Cockpit openen" knop** in primary-groen accent
- **LotTypesSelector default ingeklapt** (was open)

### Klanten-UI uitbreiding

- **✏-bewerk-knop** per klant-rij in `InterestedClientsField` (commit 5e5f982)
- `AddClientForm` hernoemd naar `ClientForm` met mode='add' | 'edit'
- Twee nieuwe helpers in `lib/clients.js`: `updateClientName` en
  `updateLotInterestedNotes`

### Cockpit stap 5 (commit 5e5f982)

- "Mijn voorbereiding" gebruikt nu auto-save `NoteField` ipv read-only
  `NoteRow` zodat Frederik tijdens veilen kan bijschrijven

### Bedragen-formatting

- **`AutoSaveNumber` `displayWithThousands`** doet nu ook datalist-
  presets met geformatteerde labels (€5.000 ipv 5000)
- **`BidStepRulesEditor`** heeft `RANGE_PRESETS` en `STEP_PRESETS`
  ([5.000, 10.000, ...] en [100, 200, 500, ...]) als datalist-suggesties
  in de Van/tot/stap-velden

---

## Live URLs

- **Productie / iPad-bookmark voor 5 mei**: https://veiling-pro.vercel.app
- **Cockpit Aloga**:
  https://veiling-pro.vercel.app/cockpit/bef304a5-29fc-47b3-af37-e808205ae60d

---

## Nog door Frederik te doen vóór 5 mei

1. **Migratie 0010 runnen in Supabase** (vervangt 0009, dropt en
   herstelt spotters-tabel met junction-structuur). Frederik heeft
   migratie 0009 al gerund — 0010 is destructive voor eventuele
   spotter-data daarvan, maar er was nog geen productie-data
2. **Reset-data**: `scripts/reset-auction.sql` plus eventueel sectie 4
   voor klanten + handmatig spotters opnieuw invoeren
3. **iPad-test** in landscape:
   - Cockpit doorlopen, drie-knop-flow + hamer-modal werken
   - Pedigree-tree leesbaar?
   - Spotters-strip zichtbaar boven lot-picker?
   - Klanten toevoegen + ✏-bewerken
   - Catalogustekst/EquiRatings ✏-knop
   - Modal sluiten met Esc en klik buiten

---

## Wat zou fout kunnen gaan

- **Migratie 0010 dropt de oude spotters tabel** — als Frederik
  productie-spotters had, weg. Niet hoogstwaarschijnlijk maar wel
  verifiëren
- **Datalist in displayWithThousands-modus** — copy-paste van een
  preset met punten (bv. "€5.000") gaat door de strip-non-digits
  filter en wordt netjes 5000. Edge case bij snelle vingers nog niet
  uitvoerig getest
- **Spotters-autocomplete** zoekt enkel op naam-prefix (ILIKE
  `query%`); spotter halverwege-zoek werkt niet (bv. "anssens" matcht
  geen "Janssens"). Bewust zo gehouden — full-text-search is overkill
- **EditableLongText** in edit-modus heeft geen "Klaar"-knop als
  initialValue leeg was. By design — gebruiker kan altijd wegklikken,
  auto-save vangt op
- **Modal Esc/backdrop** sluit ook als gebruiker per ongeluk klikt
  buiten het venster — kan een verloren-data-risico zijn als prijs
  gedeeltelijk ingevuld. Geen confirmation-dialog. Acceptabel risico

---

## Hoe rollback indien nodig

- Per commit: `git revert <hash> && git push`
- Voor specifieke schema-rollbacks (drop kolom): SQL handmatig in
  Supabase. `client_auction_seating`, `auction_spotters`, `spotters`
  tabellen via DROP TABLE
- Vercel-deploy rollback: dashboard → Deployments → vorige Ready →
  Promote to Production

---

## Volgende code-sessie — opstartstappen

Op de Mac Mini:

```bash
cd ~/veiling-pro
git pull
npm install
claude
```

**Eerste prompt:**
> "Lees PROJECT_STATUS.md, MASTER_PROMPT.md, DEVELOPER_SETUP.md en de
> meest recente reports/-bestanden voor context. Werkwijze geldt
> onverkort. Daarna: [taak]."

---

## Resterend werk na 5 mei

- "Kopieer bid-step-staffel van vorige veiling" (Frederik's wens 30-04)
- Range-overlap-validatie met visuele waarschuwing in BidStepRulesEditor
- Drop deprecated kolommen (`lots.bid_steps` text, `lots.lot_type` text,
  `lots.buyer` text)
- Foto-upload voor spotters via Supabase Storage (nu via URL-veld)
- Klanten-overzichtspagina (alle klanten van het huis op één plek)
- Eventueel: een drag-and-drop voor spotters-volgorde (nu ↑/↓-knoppen)
