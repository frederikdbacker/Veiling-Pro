# Audit — Fase 2 compleet (alle 6 items)

**Datum:** 6 mei 2026 (zelfde sessie als Fase 0 + spotter-fix + Fase 1)
**Sessie:** Code (vanaf MacBook)
**Type:** Schema-werk + UI-redesign + bonus features + rich-text-editor

---

## Context

Na de afronding van Fase 1 stelde Frederik voor om door te pakken naar
Fase 2. Het oorspronkelijke advies was om Fase 2 in een verse sessie
aan te pakken (geschat 5-7u, destructieve migraties), maar Frederik
koos om in dezelfde sessie verder te gaan. Alle 6 items zijn voltooid.

POST_ALOGA_ROADMAP.md regels 399-415 (Fase 2) zijn volledig afgewerkt.

---

## Wat is er gewijzigd in deze sessie (Fase 2-werk)

### Item #13 — Lot-type verplicht + auto-afleiden

**Migratie 0013_lot_type_required.sql** (commit `29ed8a1`)
- `lots.lot_type_id` → NOT NULL
- Nieuwe kolom `lots.lot_type_auto bool default false`

**Code:**
- `LotTypeDropdown` aangepast: zet `lot_type_auto: false` bij user-wissel.
  Nieuwe marker "✨ automatisch toegekend, klik om te wijzigen" wanneer
  `lot_type_auto = true`. "— kies —" optie verwijderd (NULL kan niet meer).
  `savedAt` clear bij elke handleChange (vroegere indicators bleven hangen).
- `scripts/import-lots.mjs`: lot_types ophalen, deriveLotType per horse
  (geen jaar → embryo, jaar = lopend → veulen, discipline-match,
  fallback springpaard); always `lot_type_auto: true` bij script-pick.

### Item #7 — Notitievelden herstructureren (aanpak C)

**Migratie 0014_notes_restructure.sql** (commit `29ed8a1`)
- `notes_org` → rename naar `notes_organisatie` (data behouden)
- 4 nieuwe kolommen: `notes_familie`, `notes_resultaten`, `notes_kenmerken`,
  `notes_bijzonderheden`
- `notes_catalog` en `notes_video` blijven staan voor handmatige overzetting
  (aanpak C). Drop volgt in een toekomstige migratie 0018+.

**UI:**
- LotPage Mijn notities: 5 nieuwe NoteFields (compact-modus)
- LegacyNoteRow component toont oude `notes_catalog`/`notes_video` read-only
  met ✕-verwijder-knop; blok verdwijnt zodra beide leeg zijn
- CockpitPage: 5 NoteFields, alleen tonen wanneer inhoud aanwezig

### NoteField verbeteringen (commit `29ed8a1`)
- Nieuwe `compact`-prop: marginTop 0.2rem, rows=1, auto-resize via
  scrollHeight, no resize-handle
- Label optioneel (skip render als undefined)
- Idle-puntje "·" weg uit SaveIndicator

### Bonus: Opmerkingen verkoop (commit `29ed8a1`)
**Migratie 0015_notes_verkoop.sql**: `lots.notes_verkoop text` (additief).
Nieuwe Card "Opmerkingen verkoop" alleen in cockpit, altijd zichtbaar
ook leeg (live-veiling-input). NoteField gerenderd zonder label (Card-titel
volstaat).

### Item #1 — Sterrenrating per lot (commit `512cf0b`)

**Migratie 0016_lot_rating.sql**: `lots.rating int` met check-constraint
(NULL of 1-5).

**Nieuw component** `src/components/StarRating.jsx`:
- 5 klikbare sterren met auto-save
- Klik op huidige rating wist (rating = NULL)
- Hover-preview, optimistische update + revert bij DB-fout
- `readOnly`-modus voor live cockpit
- `setHover(0)` na click zodat preview niet blijft hangen wanneer cursor
  op dezelfde positie blijft (LotPage zonder re-sort)

**Integraties:**
- LotPage: rating-veld in "Lot & prijzen" Block, vertikaal gecentreerd
  via min-height wrapper (alignItems flex-end op parent zou anders stars
  te hoog zetten)
- AuctionPage: stars rechts in elke LotRow (buiten Link, klik navigeert
  niet); nieuwe sort-mode 'rating'; toggle-knop "🙈 verberg ratings" /
  "👁 toon ratings"
- AuctionPage lots-query uitgebreid met `rating` (was eerder column-list
  zonder rating, daardoor leek sort op rating als alfabetisch te sorteren)
- CockpitPage: read-only stars in identity-card

**Bonus: clear-all-ratings**
- "✕ wis alle ratings"-knop op AuctionPage met confirm-dialoog +
  count van te wissen ratings; bulk update via supabase

### Item #15 — Catalogustekst + EquiRatings samenvoegen (commit `e0115ae`)

LotPage: twee aparte Blocks "Catalogustekst" en "EquiRatings" gemerged
tot één Block "Beschrijving" met witruimte tussen de twee EditableLongText-
velden. DB-kolommen blijven apart.

### Item #11 — Hengst-keuring + stamboeken (commit `e0115ae`)

**Migratie 0017_stallion_approval.sql**: `lots.stallion_approved bool
default false` + `lots.approved_studbooks text[] default '{}'`.

**Nieuw bestand `src/lib/studbooks.js`**: 31 stamboeken in volgorde
"veelgebruikt eerst" (BWP, KWPN, SBS, HANN, OLD, SF, Z) + rest alfabetisch.

**Nieuw component** `src/components/StallionApprovalField.jsx` met
block-modus en inline-modus (compact "ggk"-label + chips + add-dropdown).
Inline-modus inline geplaatst naast "Hengst" in de meta-regel op LotPage —
conditioneel zichtbaar enkel bij `gender.toLowerCase() === 'hengst'`.
Aparte "Hengstkeuring"-Block verwijderd op vraag van Frederik.

**AuctionPage rij**: "ggk" achter geslacht in meta-regel wanneer
stallion_approved=true (lots-query uitgebreid met `stallion_approved`).

**CockpitPage meta-regel**: "Hengst ggk (BWP, KWPN)" inline; aparte
"Gekeurd"-regel verwijderd. Tussen haakjes lege wanneer geen stamboeken.

### Cockpit refinements (commit `e0115ae`)
- Lot-picker layout naar grid: `[← Vorig]` links | "Actief lot:
  [dropdown]" gecentreerd | `[Volgend →]` rechts (was alle naast elkaar
  links)
- Dropdown bevat enkel `#nr Naam` (geen extras meer) — alle detail-info
  staat in de identity-card eronder
- Cockpit prijs-blok: start- en reserveprijs naast elkaar (was onder
  elkaar) — ruimtewinst in actie-kader

### Item #27 — Rich-text-editor (commit `3dd2146`)

**TipTap-dependencies geïnstalleerd:**
- `@tiptap/react`
- `@tiptap/starter-kit` (paragraph + bold; italic/lists/headings/code
  expliciet uitgeschakeld via `configure`)
- `@tiptap/extension-underline`
- `@tiptap/extension-highlight` (multicolor)

**Nieuw component** `src/components/RichNoteField.jsx`:
- Toolbar: B (bold), U (underline), 4 highlight-swatches (donker geel
  `#854D0E`, donker groen `#166534`, donker rood `#991B1B`, donker
  blauw `#1E40AF` — gekozen voor leesbaar contrast op donker thema
  met witte tekst-kleur op de mark)
- Auto-save met debounce 800ms (zelfde patroon als NoteField)
- `compact`-prop voor strakke spacing
- Export `isRichEmpty(html)` voor cockpit conditional render (TipTap
  empty content = `<p></p>`, niet plat-leeg maar gebruikers-leeg)
- Opslag: HTML-string in dezelfde `notes_*`-kolommen, geen migratie.
  Bestaande plain-text laadt naadloos als paragraph.

**`src/index.css` uitgebreid** met `.rich-note-content .ProseMirror`-styles
(donker thema, focus-ring, mark-styling met witte tekst).

**LotPage** Mijn notities: 5 NoteField → 5 RichNoteField.
**CockpitPage** Mijn voorbereiding: idem, plus `isRichEmpty` in conditional
render om `<p></p>`-content niet te tonen tijdens live.

**NoteField (plain-text) blijft bestaan** voor catalogus / video /
organisatie-historie / opmerkingen-verkoop — bewust niet rich-text per
roadmap.

Bundle: 532 kB → 920 kB (TipTap + ProseMirror), Vite warning blijft.

### Workflow-aanpassing (memory)
Tijdens de sessie afgesproken: voor low-risk UI-wijzigingen wordt voortaan
zonder voorafgaande plan-bevestiging geïmplementeerd, met visuele check
achteraf via de browser. Plan-mode blijft voor DB-migraties, destructieve
ops en multi-file refactors. Vastgelegd in
`feedback_iterate_fast_for_ui.md`.

---

## Wat zou fout kunnen gaan

- **Productie-data verlies in `notes_catalog` / `notes_video`** — beide
  kolommen bestaan nog (aanpak C), maar Frederik moet uiteindelijk per
  lot besluiten welke content over te zetten naar de nieuwe rubrieken
  vooraleer migratie 0018 (toekomstig) deze kolommen dropt. CSV-backup
  van `lots` is gemaakt vóór migratie 0014.
- **Bundle is groter** — 920 kB. Nog geen issue gemeld op iPad of mobile,
  maar code-splitting voor de cockpit-route wordt aanbevolen wanneer
  laad-tijd op tablet een issue wordt.
- **Bestaande notitiedata in 5 nieuwe rubrieken is plain text**, TipTap
  laadt het als `<p>...</p>`. Geen verlies maar de eerste edit converteert
  naar HTML-formaat — onomkeerbaar zonder data-conversie.
- **Hengst-keuring: gender-string match is case-insensitive op exact
  "hengst"** — als gender ergens "Hengst" of "stallion" of vrij ingevoerd
  is, valt het stuur weg. Aloga 2026 lots gebruiken "hengst" lowercase.
- **Cockpit dropdown** toont nu enkel `#nr Naam` — minder context dan
  voor de revert. Identity-card eronder vult dit aan, maar wisselen
  tussen lots vraagt nu een blik op de identity-card voor type-info.
- **Highlights met oude (lichte) kleuren** in eventueel test-data van
  vandaag worden niet automatisch gemigreerd — die houden hun bleke
  kleur. Re-applicatie nodig.
- **Rating clear-all is destructief**: 1-click bulk-wissing van alle
  ratings in een veiling. Confirm-dialoog vraagt expliciet, maar geen
  undo.

---

## Wat moet visueel gecontroleerd worden

1. **Productie deploy van commits** `29ed8a1`, `512cf0b`, `e0115ae`,
   `3dd2146` op https://veiling-pro.vercel.app — Vercel triggert
   automatisch.
2. **LotPage** van een hengst-lot: Hengstkeuring inline naast "Hengst"
   in meta-regel, ggk-checkbox + chips werken.
3. **LotPage** Mijn notities: 5 rich-text-velden met toolbar
   (bold/underline/highlight). Type tekst, formatteer, refresh — formattering
   blijft.
4. **AuctionPage**: ratings tonen + sort-knop "★ Rating" werkt; clear-all
   werkt; verberg-toggle werkt; "ggk" achter hengst.
5. **Cockpit**: Lot-picker rij in 3-kolom layout (Vorig | dropdown |
   Volgend), dropdown beperkt tot `#nr Naam`, identity-card heeft
   thumbnail + lot#·type + meta + rating + pedigree; prijzen naast
   elkaar; Mijn voorbereiding toont enkel rubrieken met inhoud (rich-text
   formattering zichtbaar); "Opmerkingen verkoop"-Card altijd zichtbaar.

---

## Hoe rollback indien nodig

### Code-rollback Fase 2
```bash
cd ~/veiling-pro
git revert 3dd2146 e0115ae 512cf0b 29ed8a1
git push
```
(In omgekeerde volgorde — meest recent eerst.) Dit zet UI/code volledig
terug naar de Fase 1-eindstand. Schema-migraties blijven actief.

### Schema-rollback (per migratie)
- 0017: `alter table lots drop column stallion_approved, drop column approved_studbooks;`
- 0016: `alter table lots drop constraint rating_range; alter table lots drop column rating;`
- 0015: `alter table lots drop column notes_verkoop;`
- 0014: `alter table lots add column notes_org text; update lots set notes_org = notes_organisatie; alter table lots drop column notes_organisatie, drop column notes_familie, drop column notes_resultaten, drop column notes_kenmerken, drop column notes_bijzonderheden;`
- 0013: `alter table lots drop column lot_type_auto; alter table lots alter column lot_type_id drop not null;`

CSV-backup van vóór migratie 0014 is bewaard door Frederik (gemaakt op
verzoek tijdens de sessie).

### Vercel
Geen specifieke deploy-rollback nodig — alle wijzigingen zijn nieuwe
features bovenop bestaande functionaliteit.

---

## Resterend werk / volgende sessie

- **Migratie 0018 (toekomstig)** — `lots.notes_catalog` en
  `lots.notes_video` droppen zodra Frederik klaar is met handmatig
  overzetten naar de nieuwe rubrieken
- **Aloga-spotters opnieuw invoeren** — testrij was verloren bij
  migratie 0010
- **Item #14 migratie** — `bidding_mode`-kolom toevoegen aan
  `client_auction_seating` zodra Fase 3 aanvangt
- **Bundle code-splitting** — cockpit-route lazy-loaden om iPad-laad-
  tijd onder controle te houden
- **Open-issue #25** (extern apparaat) — concept-evaluatie, geen
  implementatie tot Frederik beslist

### Volgende fase: Fase 1.5 of Fase 3?

Per POST_ALOGA_ROADMAP.md:
- **Fase 1.5** — grote rename `auctions` → `collections` + breadcrumbs
  (item #17, ~2-3u, raakt 12 migraties, 1 aparte sessie)
- **Fase 3** — klantenbeheer uitgebreid (items 8, 14, 21, 22, 22b, 2, 18;
  ~4-6u, 2 sessies)

Roadmap raadt Fase 1.5 aan vóór Fase 3 omdat alle features daarna op de
nieuwe namen bouwen. Aanbeveling voor volgende sessie: Fase 1.5 in een
verse, gefocuste sessie.
