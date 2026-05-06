# Audit — Spotter-fix + pre-fase checks + Fase 1 quick wins

**Datum:** 6 mei 2026 (zelfde sessie als Fase 0, ná de iCloud→git overgang)
**Sessie:** Code (vanaf MacBook)
**Type:** Bug-fix in productie (migratie) + 3 dashboard-checks + 5 UI-items uit Fase 1

---

## Context

Na afronding van Fase 0 (zie `2026-05-06_fase-0-icloud-naar-git.md`) zijn
in dezelfde sessie drie blokken werk gedaan: het spotter-toevoegen-bug
verholpen via een migratie in productie, de drie pre-fase Supabase-checks
uit POST_ALOGA_ROADMAP.md uitgevoerd, en alle 5 quick wins van Fase 1
geïmplementeerd. De sessie is afgesloten vóór Fase 2 (op aanbeveling —
Fase 2 verdient een verse sessie wegens destructieve schema-wijzigingen).

Tijdens deze sessie is ook een werkwijze-aanpassing afgesproken: voor
low-risk UI-werk wordt voortaan zonder voorafgaande plan-bevestiging
geïmplementeerd, met visuele check achteraf via de browser. Plan-mode
blijft gelden voor DB-migraties, destructieve operaties en multi-file
refactors. Vastgelegd in memory-bestand
`feedback_iterate_fast_for_ui.md`.

---

## Wat is er gewijzigd in deze sessie

### Spotter-toevoegen-bug verholpen (migratie 0010 in productie)

Foutmelding `Could not find the 'notes' column of 'spotters' in the schema
cache` bleek een schema-code-mismatch: code (`src/lib/spotters.js`)
verwachtte het globaal-spotters-schema uit migratie 0010
(`spotters` met kolommen `id, name, photo_url, notes` + junction
`auction_spotters`), terwijl de productie-database nog op het
0009-schema stond (per-veiling-spotters zonder `notes`-kolom). De
migratie was eerder gedocumenteerd als open in PROJECT_STATUS.md regel
165 maar nooit uitgevoerd.

**Fix:** migratie 0010 gerund via Supabase Dashboard SQL Editor.
Eén testrij ging verloren (`drop table if exists spotters` aan begin
van migratie); door Frederik akkoord bevonden.

**Verificatie:** in de UI een testspotter toegevoegd via
SpottersField op AuctionPage — geen foutmelding meer, naam blijft
staan.

PROJECT_STATUS.md regel 165 strikethrough'd naar AF op 06-05-2026.

### Pre-fase Supabase-checks (3 bevindingen)

| Tabel | Vraag | Bevinding | Implicatie |
|---|---|---|---|
| `lots` | bestaat een video-URL-kolom? | `video_url` + `url_extra` aanwezig | items #4 en #10b zijn pure UI-wijzigingen (geen migratie) |
| `lot_types` | staan veulen + embryo seed-rows? | "alles erbij" | item #13 vereist geen seed-migratie, alleen kolom-aanpassing + auto-afleiden in code |
| `client_auction_seating` | bestaat `bidding_mode`-kolom? | nee — kolommen zijn `client_id, auction_id, table_number, direction, notes, created_at` | item #14 (Fase 3) vereist een additieve migratie om `bidding_mode`-enum toe te voegen |

### Fase 1 — 5 quick wins (commit `af8ddee`)

**#3 — Vorig/volgend lot-navigatie bovenaan LotPage** (`src/pages/LotPage.jsx`)

Eerste iteratie: aparte nav-rij boven de breadcrumb. Frederik gaf
feedback dat dit verticale ruimte verspilde. Tweede iteratie: nav-knoppen
en dropdown geïntegreerd in de header-rij naast de paardennaam. Derde
iteratie: dropdown vervangt de h1-titel (omdat dropdown het huidige lot
sowieso toont — dubbel werk). Vierde iteratie: hoogte-uitlijning gefixt
via expliciete `height: 36px` + `boxSizing: border-box` op zowel
`<button>` als `<select>` met `display: inline-flex` voor centrering
van het arrow-glyph. Eindlayout:

```
[thumb96]  [←]  [#X — Naam ▾]  [→]
                meta-regel
```

Bottom-nav blijft staan (conform roadmap-tekst). Pijltjestoetsen ← →
ongewijzigd. Dropdown navigeert direct bij `onChange`.

**#9 — Geboortejaar + leeftijd combineren** (`src/pages/LotPage.jsx`)

Meta-regel toont nu "Springpaard · 2019 / 7 jaar · ruin · KWPN ·
168cm" i.p.v. "Springpaard · 2019 · ...". Berekend via
`new Date().getFullYear() - lot.year`, met `Math.max(0, ...)` voor
edge-case van veulens geboren in lopend jaar (toont "0 jaar").

**#4 — Video-waarschuwing weg + video-URL-concept opgeruimd**
(`src/pages/LotPage.jsx`, `src/pages/CockpitPage.jsx`,
`src/lib/missingInfo.js`)

Roadmap vroeg waarschuwing weg. Frederik gaf aan dat als er geen plek
is om een video-URL in te voeren, het hele concept beter weg kan.
Verwijderd: Video-Block (LotPage), `videoWrapStyle` +
`videoIframeStyle` styles, `video_url` LABEL uit missingInfo.js.
Behouden: `notes_video` notitieveld in zowel LotPage (Mijn notities)
als CockpitPage (Mijn voorbereiding) — apart concept van video-URL,
op verzoek van Frederik. DB-kolommen `lots.video_url` en
`lots.notes_video` ongewijzigd. `HIDDEN_FROM_BANNER`-filter in
missingInfo.js blijft als defensieve catch voor oude scrape-data.

**#10b — "Extra" → "Auction page" hernoemen**
(`src/pages/LotPage.jsx`, `src/pages/CockpitPage.jsx`)

UI-label op AutoSaveUrl voor `url_extra` veld op LotPage en op
ExternalLink in cockpit veranderd. DB-kolom blijft `url_extra` heten.
Item 10a (scrape-uitbreiding om bron-URL automatisch in te vullen)
hoort bij Fase 6 — niet aangepakt.

**#16 — Lottype-uitlijning op LotPage**
(`src/components/LotTypeDropdown.jsx`)

Twee verschillen met AutoSaveNumber gevonden en gefixt:
1. Outer `<div>` had geen `marginBottom`. Toegevoegd `'0.75rem'` matchend
   met AutoSaveNumber wrapper. Effect: dropdown valt niet meer onderaan
   bij `alignItems: flex-end`.
2. Label-overrides verwijderd (`fontSize: '0.85em'`,
   `color: 'var(--text-secondary)'`, `letterSpacing: '0.04em'`). Label
   inherit nu standaard fontSize en text-primary kleur, matchend met
   andere prijs-velden — wit + bold.

---

## Wat zou fout kunnen gaan

- **Spotter-data verloren tijdens migratie 0010.** Eén testrij is
  bewust opgeofferd. Geen productie-spotters waren actief, dus impact
  beperkt. Frederik zal de echte spotters opnieuw moeten invoeren via
  AuctionPage SpottersField wanneer dat aan de orde is.
- **Lot-pages zonder lot.year** — meta-regel toont nu geen jaar/leeftijd
  meer als `lot.year` null is (filter `Boolean`). Geen breaking change,
  maar lege jaren-kolommen tonen niets. Voor Aloga 2026 zijn alle 24
  lots verrijkt met jaar.
- **Video-URL-concept opgeruimd** — als Frederik later toch een
  video-URL wil plaatsen, kan dat niet meer via UI. DB-kolom
  `lots.video_url` bestaat nog wel; theoretisch via Supabase Dashboard
  in te vullen. UI-component zou opnieuw gebouwd moeten worden indien
  nodig (paar regels JSX uit deze commit terug te zetten).
- **Header-dropdown op LotPage** — bevat alle 24 lots. Bij collecties
  van 50+ lots zou dit lang scrollen worden. Niet relevant voor Aloga
  2026; eventueel later virtualiseren of segmenteren.
- **Lottype-dropdown styling** — door wrapper `marginBottom: 0.75rem`
  is de visuele spacing onder LotTypeDropdown nu groter. Klopt met
  hoe AutoSaveNumber zich gedraagt; zou geen storend effect mogen geven.

---

## Wat moet visueel gecontroleerd worden

1. **Productie-deploy van commit `af8ddee`** op
   https://veiling-pro.vercel.app — Vercel triggert automatisch.
2. **LotPage** (een Aloga-lot): header-rij met thumbnail | ← |
   dropdown ▾ | →. Klik op pijltjes en dropdown — navigeert correct.
   Meta-regel toont jaar+leeftijd. "Auction page" als veldlabel onder
   Externe links. Lot-type op gelijke hoogte met prijs-velden, wit+bold
   label. Geen Video-blok zichtbaar (tenzij `lot.video_url` toch gevuld
   zou zijn — niet het geval bij Aloga 2026).
3. **AuctionPage**: spotter toevoegen (zou nu moeten werken).
4. **Cockpit**: externe links tonen "Auction page". Mijn voorbereiding-
   sectie heeft nog steeds Catalogus / Video / Organisatie als
   notitievelden.

---

## Hoe rollback indien nodig

### Code-wijzigingen (Fase 1)
```bash
cd ~/veiling-pro
git revert af8ddee
git push
```
Zet alle 5 Fase 1-items + PROJECT_STATUS-update terug. Spotter-fix in DB
blijft staan (geen code-rollback van schema).

### Migratie 0010 terugdraaien
Onwaarschijnlijk gewenst. Mocht het toch nodig zijn:
```sql
drop table if exists auction_spotters;
drop table if exists spotters;
-- en migratie 0009 opnieuw runnen
```
**Niet aanbevolen** — code in `src/lib/spotters.js` verwacht het
0010-schema. Code-rollback nodig vóór schema-rollback.

### Vercel
Geen migratie-gevoelige Vercel-actie. Mocht een Vercel-deploy falen:
dashboard → Deployments → vorige Ready → Promote.

---

## Resterend werk

- **Spotters opnieuw invoeren** in productie als Frederik die actief wil
  hebben (testrij is verdwenen tijdens migratie 0010).
- **Item #14 migratie** — `bidding_mode`-kolom toevoegen aan
  `client_auction_seating` zodra Fase 3 aanvangt.
- **Open-issue #25** (extern apparaat) — concept-evaluatie, geen
  implementatie tot Frederik beslist.

---

## Volgende stap

**Fase 2** in een fresh sessie. Roadmap-volgorde:
- (13) Lot-type verplicht + auto-afleiden — fundament, kleine migratie
- (7) Notitievelden herstructureren — schema-werk samen met 13 in één
  migratie (DESTRUCTIEF: oude kolommen `notes_catalog`, `notes_video`,
  `notes_org` worden vervangen door familie/resultaten/kenmerken/
  organisatie/bijzonderheden)
- (27) Rich-text-editor in notitievelden
- (1) Sterrenrating
- (11) Hengst-gekeurd + stamboek
- (15) Catalogustekst + EquiRatings samenvoegen

Geschat 5-7 uur over 2 sessies. Voor sessie-start: dit document + Fase 0-
audit lezen, daarna POST_ALOGA_ROADMAP.md regels 399-415 (Fase 2).
