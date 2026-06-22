# Dagrapport — 22 juni 2026

Eén lange werkdag met **zes PRs** gemerged op `main`. Vercel deployt na elke
merge automatisch. Verschillende thema's; elke PR is een afgeronde eenheid
voor zich.

| PR | Thema | Merge-commit | Aparte rapporten |
|---|---|---|---|
| #13 | Hernoeming `scrape-fences-selection.mjs` → `-catalogus.mjs` | `a90096f` | `2026-06-22_rename-fences-selection-naar-catalogus.md` |
| #14 | Fences-PDF SELECTION 2026 → pedigree-bomen + moederlijn-tekst voor 76 lots | `c7df3ed` | `2026-06-22_fences-pdf-pedigree-import.md` + `2026-06-22_fences-pdf-merge-conflicten.md` |
| #15 | Werkwijze-overdracht uit FEI-project — Golf 1 (data-agent, settings, hooks, CLAUDE.md regel 9) | `b8e64e2` | — (in dit dagrapport, sectie 3) |
| #16 | Cockpit deel 2A — bod-tracker spotter-knoppen + sneltoetsen + online-detectie | `c4aa01a` | — (in dit dagrapport, sectie 4) |
| #17 | Cockpit deel 2B — sticky balk herzien + dynamische veldvolgorde + privacy-toggle | `b82c6c8` | — (in dit dagrapport, sectie 5) |
| #18 | Lege-cockpit-fix — lot-dropdown ook zichtbaar zonder actief lot + prominent leeg-state-blok | `8c5eb55` | — (in dit dagrapport, sectie 6) |

---

## 1. PR #13 — Fences-script rename

Klein chore-commitje als opvolging van een kanttekening uit de sessie van
21 juni. `scrape-fences-selection.mjs` heette misleidend (suggereerde
gebondenheid aan één SELECTION-veiling) terwijl het script generiek werkt
voor elke Fences-catalogus-pagina. Hernoemd naar `-catalogus.mjs` (en
idem voor `import-fences-selection.mjs`).

Naam `vente` afgevallen omdat er al `scrape-fences-ventes.mjs` bestaat
(lijst-scraper via 4D-API) — te dicht bij elkaar voor leesbaarheid.

Volledige beslissingen in
`reports/2026-06-22_rename-fences-selection-naar-catalogus.md`.

---

## 2. PR #14 — Fences-PDF SELECTION 2026 → pedigree + moederlijn

**Resultaat**: alle 76 lots van *La Vente de Deauville Sélection 2026*
(Fences, 29 juni 2026, collectie `a3c9ac43-…`) zijn op productie verrijkt
met:
- volledige 3-generatie pedigree-boom (sire+dam → 8 overgrootouders)
- moederlijn-tekst tot 4 generaties (Père / 1ère / 2ème / 3ème / 4ème mère)
- familie-samenvatting onderaan ("On retrouve…")

**Migraties**:
- 0029: `lots.maternal_line jsonb` (additief)
- 0030: `drop column maternal_line` (na herstructurering)

**Architectuur-pivot tijdens de sessie**: aanvankelijk gebouwd met
`maternal_line` als aparte kolom. Bij UI-onderzoek bleek dat de
bestaande `PedigreeTexts`-component (`src/components/PedigreeTree.jsx:131`)
al exact deze data toont, maar leest van `text`-velden ON de
pedigree-knopen (`pedigree.dam.text`, etc.) — zoals Vente de Service
19/06/2026 al gebruikte. Frederik koos voor hergebruik: data verhuisd
naar pedigree-knopen, kolom gedropt. Resultaat: nul React-werk, alle 76
lots tonen automatisch in de bestaande UI.

**Productie-stats** na her-import:
- 76/76 hebben `pedigree.sire.text` (Père)
- 76/76 hebben `.dam.text` + `.dam.dam.text` (1ère + 2ème mère)
- 67/76 hebben `.dam.dam.dam.text` (3ème mère)
- 35/76 hebben `.dam.dam.dam.dam.text` (4ème mère)
- 0 conflicten (DB had nog geen text-velden)
- 8 naam-verschillen (7 ontbrekende accenten, 1 mogelijke PDF-typfout op
  lot 43) — DB-namen onaangeraakt

**Pipeline**:
- `scripts/parse-fences-pdf-catalogus.mjs` — PDF (pdftotext -layout) → JSON
- `scripts/import-fences-pdf-enrichment.mjs` — slim-merge, conflict-log

**Edge-cases die de parser moest oplossen**:
- Split-BTW notatie (lot 25 NOGARO, lot 57): `67% avec TVA` / `33% sans TVA`
- Sex-token `h.` (hongre/ruin) i.p.v. `m.`/`f.` (lot 10, 30, 70)
- Twee kolommen op één regel (lot 19 NIFRANE)
- Page-footer-watermark midden in pedigree-tabel
- Multi-line cellen (NIXON VAN'T / MEULENHOF / bwp verspreid)
- Unicode-letters (KROKUSBLÜTE)

Volledige edge-case-lijst + beslissingen in
`reports/2026-06-22_fences-pdf-pedigree-import.md`.

---

## 3. PR #15 — Werkwijze-overdracht uit FEI-project, Golf 1

Frederik deelde de FEI-werkwijze-overdracht
(`~/Library/Mobile Documents/com~apple~CloudDocs/horseshow-werk/notes/
werkwijze_overdracht_2026-06-22.md`) en vroeg om relevante delen over te
nemen voor veiling-pro. Vier wijzigingen, allemaal additief.

### Vergelijking en keuze

Drie golven werden geïdentificeerd. Frederik koos voor **Golf 1**
(snel + direct nut + laag risico) en wees Golf 2 (audits naar iCloud,
auto-push) bewust af. Golf 3 (OPEN_TASKS Supabase-tabel) wordt overgeslagen
voor solo-project.

### Wijzigingen in PR #15

1. **`.claude/agents/data-agent.md` geformaliseerd** — MASTER_PROMPT
   noemde drie sub-agents maar geen ervan was als `.claude/agents/*.md`
   gerealiseerd. Data-agent krijgt nu de juiste rolprompt bij elke
   scraper/importer/migratie-sessie. Builder en content-agent blijven
   voorlopig conceptueel.
2. **`.claude/settings.json` team-allowlist** — minimale set veilige
   commando's (`npm run *`, `git status/log/diff`, `node scripts/*`,
   `pdftotext`, Supabase-MCP read-only) zonder popup. Destructieve
   acties blijven popup-vereist.
3. **`.githooks/pre-commit` + `scripts/prune_project_status.py`** —
   houdt PROJECT_STATUS.md onder 100 KB door oudste sessie-headers naar
   `PROJECT_STATUS_ARCHIVE_<jaar>.md` te verplaatsen. Op deze Mac al
   geactiveerd; op Mac mini + MacBook éénmalig handmatig draaien:
   `git config core.hooksPath .githooks`.
4. **`CLAUDE.md` aanvulling** — regel 6 versterkt (`git add <pad>`
   altijd, nooit `-A`/`.`/`-a`) + nieuwe regel 9: sessie-einde-checklist
   die letterlijk uitgetypt + afgevinkt moet worden bij afsluit-signaal.
   Audit komt EERST (punt 1), niet laatst. **Dit dagrapport is de eerste
   echte toepassing van regel 9.**

---

## 4. PR #16 — Cockpit deel 2A: bod-tracker spotter-knoppen + sneltoetsen

Vervangt de spotter-dropdown door direct klikbare knoppen en voegt
sneltoetsen toe. Online-bieden krijgt een eigen knop (blauw-getint) +
sneltoets, en de Verkocht-pop-up herkent de online-keuze direct.

### Keyboard-map

```
↑ / spacebar  → +1 biedstap
↓             → −1 biedstap
← →           → spotter links / rechts (CLAMP aan de randen, geen wrap)
O             → online-knop (alleen als online_bidding_enabled aan staat)
```

### Beslispunten + Frederiks correcties tijdens de plan-iteraties

- **Wrap-around → CLAMP**: aanvankelijk wrap-around voorgesteld; Frederik
  wees terecht op "veilingdruk = rand voelen, geen rond-tollen".
- **ONLINE_SENTINEL als gedeelde constante**: één export uit BidTracker
  (= `'__online__'`), import in CockpitPage. Geen vier losse literals
  verspreid (typo-risico).
- **`'__online__'` in hamer-form opvangen i.p.v. "later"**: aanvankelijk
  wou ik dit als "latere fase" laten, Frederik wees terecht op het feit
  dat online-tracking nu juist het hele doel was — dus in `openHamer`
  detecteren we de sentinel en zetten `sale_channel='online'` +
  spotter-veld leeg.
- **Edge cases bij 0/1 spotters**: geen deling door 0, vroege return bij
  lege lijst.

### Defense in depth tegen spacebar-op-gefocuste-knop

1. Centrale `window.keydown` met `preventDefault` op spacebar
2. Alle knoppen blurren na klik (`e.currentTarget.blur()`)

Alle 7 visuele tests gelukt door Frederik (tests 1-6 op Aloga, test 7 op
Aloga lot 20 Fire Soul met online-detectie naar Verkocht-pop-up).

---

## 5. PR #17 — Cockpit deel 2B: sticky balk + dynamische veldvolgorde + privacy-toggle

Drie samenhangende wijzigingen, allemaal in de live-veiling-UX.

### Sticky balk herinrichting (`LiveInfoBar.jsx`)

- ← Naar veiling uiterst links, veiling-titel ernaast
- Lot-navigatie (vorig | dropdown | volgend) + lot-meta op rij 1
- Rij 2: spotters (verhuisd uit aparte `SpottersStrip`-mount), actueel
  bod live uit `trackerState`, sessie-stats rechts
- `trackerState` gelift uit `ActiveLotPanel` naar `CockpitPage` zodat de
  sticky balk het live-bod kan lezen — identiek payload-contract met
  BidTracker, sticky leest alleen
- Compacte variant ≤900px via CSS-media-query in `index.css`: ← zonder
  label, titel/pills/charity verborgen, spotters → initialen

### Dynamische veldvolgorde in kolom 2

Vijf cards (Voorouders Fences-only, Geïnteresseerden, Catalogustekst,
Mijn voorbereiding, EquiRatings) gesorteerd: gevulde bovenaan
opengeklapt, lege onderaan ingeklapt. Stable sort behoudt originele
volgorde binnen elke groep.

**`SortableCard`-wrapper**: `useRef` + `useEffect`-mount-only patroon
(geen state, geen gecontroleerde `open`-prop). Garandeert dat handmatig
dichtgeklapte Cards bij re-render binnen hetzelfde lot NIET terugspringen
naar open. `key={lot.id}` op de call-site triggert remount bij lot-wissel
zodat defaultOpen opnieuw wordt toegepast.

**Plan-iteraties met Frederik**:
- Aanvankelijk stelde ik een complete live-state-machinerie voor
  (onSaved-callbacks op RichNoteField + EditableLongText). Frederik wees
  terecht op overbouw: zijn eis was puur sorteer-bij-load, geen
  live-sync. Geschrapt → optie A.
- Aanvankelijk `<details open={filled}>` als gecontroleerde prop —
  Frederik wees op het springen-bij-re-render-probleem. Vervangen door
  `useRef`-mount-only pattern.

### Privacy-toggle voor reserve/min-prijs

- Discrete 👁 / 🙈-knop rechtsboven in de sticky balk
- Blurt zowel de **Min**-pill in de sticky als het **Start + Reserve**-blok
  in het actie-paneel van kolom 3 (één gedeelde `hidePrice`-state op
  CockpitPage)
- Filter (geen `display:none`) — layout schuift niet bij toggle
- Beide cijfers blurren, niet alleen reserve, zodat iemand uit de
  zichtbare start de geheime reserve niet kan inschatten

Frederik testte alles in browser + bevestigde: privacy-toggle werkt, klap-
keuze blijft staan na bod-stijging/spotter-switch, sticky balk gedraagt
zich op tablet portrait als verwacht.

---

## 6. PR #18 — Lege-cockpit-fix

Aankomende veilingen zonder actief lot toonden een blanco cockpit met
alleen een grijze "Kies hierboven welk lot..."-regel — verwarrend want
de dropdown verscheen pas bij een actief lot. Frederik kwam dit tegen op
productie nadat 2B was gemerged.

**Wijzigingen**:
- `LiveInfoBar`: dropdown altijd zichtbaar bij `allLots`, ook bij `!lot`.
  Placeholder-option `— Kies een lot in de piste —` als geen actief lot.
- `CockpitPage`: subtiele grijze tekst vervangen door prominent
  leeg-state-blok (🐎 paard-emoji, "Klaar om te beginnen", verwijzing
  naar de dropdown bovenaan).

Pre-bestaand gedrag (geen 2A/2B-regressie), maar storend genoeg om nu
op te lossen voor de SELECTION 2026-veiling van 29 juni.

---

## DB-acties tijdens de sessie (geen migraties)

Bewust kort: tijdens browser-tests werd het actieve lot tijdelijk gezet
in productie-DB om testbare cockpits te krijgen.

| Wat | Doel | Eindstand |
|---|---|---|
| `collections.active_lot_id` Aloga 2026 → Fire Soul lot 20 | Test 7 (verkocht-pop-up online) | Teruggezet op `null` |
| `collections.active_lot_id` SELECTION 2026 → DIA BELLA lot 5 | Eerste 2B-test | Teruggezet op `null` |
| `collections.active_lot_id` Aloga → Fire Soul (tweede keer) | 2B-test op volledige cockpit | Teruggezet op `null` |

Geen vervuilende of destructieve wijzigingen op productie-data.

---

## Bekende risico's / openstaand

- **`git config core.hooksPath .githooks`** moet éénmalig op je **Mac mini**
  en **MacBook** gedraaid worden — git-config synct niet via repo.
- **Vercel-productie-check** door Frederik vóór publiek gebruik: de
  privacy-toggle (PR #17) moet hij op de live URL bekijken voor hij
  hem in een echte veiling met publiek inzet.
- **Privacy-toggle uitbreiding**: huidige scope is sticky balk + actie-
  paneel. Andere plekken (LotPage identity-card, hamer-pop-up) blijven
  voorlopig prijs-zichtbaar. Los uit te breiden indien gewenst.
- **Lot 43 mogelijk typfout in Fences-PDF**: DB-naam "CAN'T RESIST HOF
  TER BRUGGEN Z", PDF "CAN'T RESIST OF TER BRUGGEN Z" (mist `H`). DB-naam
  onaangeraakt — Frederik kan op fences.fr verifiëren.
- **7 lots SELECTION 2026 met ontbrekende diacrieten in DB-naam**:
  NENUPHAR/NERON/L'AMITIE/CHENEE/NOE/NOUMEA/TRESOR — DB-namen
  onaangeraakt (waar bewust gekozen, niet ongelimd overschrijven).
- **Twee `.mp4`-bestanden** (`casual_dv_z.mp4`, `test.mp4`) staan al
  meerdere sessies onaangeroerd in de werkmap. Geen actie ondernomen.

---

## Verificatie

- **Build-checks**: `npm run build` slaagde vóór elke commit op alle 6 PRs.
- **DB-verificatie**: `information_schema`-checks voor migraties 0029 en
  0030 bevestigden de juiste kolom-status.
- **Productie-verificatie**: Frederik testte elk van PR #14, #16, #17,
  #18 in browser (lokaal of via Vercel preview) vóór merge.
- **Geen regressies in deel 1-flows** (verkocht-pop-up-voorinvulling) of
  deel 2A (sneltoetsen + online-detectie) na deel 2B.

---

## Rollback (per onderwerp)

| PR | Rollback-actie |
|---|---|
| #13 | `git revert a90096f` — pure rename, geen data |
| #14 | Migratie 0029/0030 zijn weloverwogen; data zit in `lots.pedigree.*.text` — rollback = SQL `update lots set pedigree = null where collection_id = '<selection>'` |
| #15 | `git revert b8e64e2` — additieve config, geen state |
| #16 | `git revert c4aa01a` — alleen UI + import-change in CockpitPage |
| #17 | `git revert b82c6c8` — alleen UI |
| #18 | `git revert 8c5eb55` — alleen UI |

Backup van vanochtend dekt nog steeds als ruwere restore nodig is.
