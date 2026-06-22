# Sessierapport — 22 juni 2026

## Fences-PDF-import: pedigree-boom + moederlijn-tekst voor SELECTION 2026

**Resultaat:** alle **76 lots** van de collectie *La Vente de Deauville
Sélection 2026* (Fences, 29 juni 2026) zijn op productie verrijkt met:

- volledige **3-generatie pedigree-boom** (vader, moeder, grootouders,
  overgrootouders) → 76/76 hebben sire+dam, 74/76 hebben alle 8 overgrootouders
- **moederlijn-tekst** tot 4 generaties diep + familie-samenvatting onderaan
  → 76/76 hebben `maternal_line`, 35/76 hebben tot generatie 4

Migratie 0029 (`lots.maternal_line jsonb`) staat additief op productie.
Commit-rapport: `reports/2026-06-22_fences-pdf-merge-conflicten.md` —
0 echte data-conflicten (alle DB-pedigrees waren `null` voor deze import).

---

## Beslissingen

### 1. Bron is de officiële PDF-catalogus, niet de website
- **Keuze:** parsen van `CAT SELECTION DEAUVILLE 2026 - WEB.pdf` i.p.v. de
  Fences-website opnieuw scrapen.
- **Waarom:** de website-scrape leverde alleen vader/moeder/moedersvader en
  helemaal geen moederlijn-beschrijving. De PDF heeft per paard een
  volledige 3-gens pedigree-tabel én 4 generaties moederlijn-tekst met
  nakomelingen-prestaties — dat is precies de voorbereidingsdata van een
  veilingmeester.
- **Afgevallen:** opnieuw scrapen + meer velden raden uit fragmenten. Te
  fragiel, te onvolledig.

### 2. Tekst-extractie met `pdftotext -layout`, niet OCR
- **Keuze:** native PDF-tekst-extract via `pdftotext -layout` (poppler).
- **Waarom:** de Fences-PDF is een echte tekst-PDF (geen scan), dus de
  inhoud zit als selecteerbare karakters in het bestand. `-layout` behoudt
  kolomstructuur (essentieel voor pedigree-tabel met 3 kolommen).
- **Afgevallen:** OCR (onnodig + traag), Node-bibliotheken (zwaarder).

### 3. Nieuwe kolom `lots.maternal_line` jsonb — niet hergebruik van bestaande velden
- **Keuze:** dedicated `lots.maternal_line` jsonb met sleutels
  `1`/`2`/`3`/`4`/`summary`.
- **Waarom:** de tekst hoort structureel niet in `pedigree` (jsonb voor de
  bracket-tree-knopen) en past niet in `catalog_text` (vrij notitieveld
  voor Frederiks eigen tekst). Aparte kolom maakt later een eigen UI-blok
  mogelijk zonder andere data te verstoren.
- **Afgevallen:** alles in `catalog_text` proppen — zou Frederiks bestaande
  notities mengen met geïmporteerde data, en is onmogelijk slim te
  presenteren.

### 4. Slim-merge per pedigree-knoop, DB heeft voorrang bij conflict
- **Keuze:** per knoop (`sire`, `sire.sire`, …, `dam.dam.dam`) wordt `name`
  en `studbook` apart vergeleken. Leeg DB-veld → vullen vanuit PDF. Gelijk
  → niets doen. Verschillend → DB behouden + log in conflict-rapport.
- **Waarom:** voor toekomstige import-runs (op andere veilingen waar de DB
  al data heeft) wil Frederik geen stille overschrijvingen. In deze
  specifieke run was de DB overal `null` dus er waren 0 echte conflicten.
- **Afgevallen:** PDF altijd laten winnen (te risicovol als handmatige
  correcties al in de DB staan); altijd vragen om beslissing (te
  bureaucratisch voor een batch van 76).

### 5. Naam-velden NIET aanraken
- **Keuze:** importer schrijft alleen `pedigree` + `maternal_line`, nooit
  `lots.name`.
- **Waarom:** de DB-namen kunnen lichte typografische verschillen hebben
  (vooral diacrieten — `NENUPHAR` vs `NÉNUPHAR`). Een naam-overschrijving
  kan andere systemen (links, URLs, klant-referenties) verstoren. 8
  naam-verschillen zijn als waarschuwing gelogd; Frederik beslist of hij
  ze handmatig wil aanpassen.

### 6. Naam-vergelijking gebruikt karakter-normalisatie
- **Keuze:** voor vergelijking worden typografische apostrof `'` ↔ ASCII
  `'` genormaliseerd en dubbele spaties weggewerkt.
- **Waarom:** zonder normalisatie zou bv. `DON'T TOUCH` (DB) ≠ `DON'T
  TOUCH` (PDF) als conflict worden gerapporteerd, terwijl ze in werkelijk-
  heid identiek zijn.
- **Beperking:** accenten worden NIET genormaliseerd (`É` ≠ `E`). Dat is
  bewust — de PDF heeft de correctere spelling (mét accenten) maar de
  importer raakt het naam-veld toch niet aan, dus dit is enkel een
  rapportage-keuze.

### 7. `birth_info` (geboortestal) wel geparsed, NIET geïmporteerd
- **Keuze:** parser extraheert `birth_info` ("Née chez Happy Paddock Bv
  (Bel)") maar de importer schrijft hem niet weg.
- **Waarom:** scope-beperking — Frederik vroeg specifiek om pedigree en
  moederlijn. Geboortestal-veld bestaat niet in `lots` en zou een aparte
  kolom + UI-keuze vragen. Eventueel later toe te voegen; data staat
  bewaard in `data/fences-selection-2026-pdf-enrichment.json` voor latere
  import indien gewenst.

---

## Wat de parser moest oplossen

De Fences-PDF is consistent qua structuur maar heeft edge-cases die elk
één extra fix vroegen. Voor de volledigheid (en zodat een volgende
import-run weet wat eraan zit):

| Edge-case | Voorbeeld | Fix |
|---|---|---|
| Split-BTW notatie i.p.v. één `avec/sans TVA` regel | Lot 25 NOGARO OPTIMUM (`67% avec TVA` + `33% sans TVA`) | Extra regex die `\d+%\s+(avec|sans)\s+TVA` herkent en de naam op een latere regel zoekt |
| Sex-token `h.` (hongre/ruin) i.p.v. `m.`/`f.` | Lot 10 NAUGHTY DU GIVRE, lot 30 THOMAS, lot 70 TAMBO | `h.` toegevoegd aan `detailRegex` |
| Twee kolommen op één regel | Lot 19 NIFRANE DU VASSAL (vader-cel + grootouder-cel op zelfde regel) | `splitRowIntoCells` splitst regels op gaps van ≥5 spaties |
| Page-footer-watermark midden in pedigree | "Vente du Lundi 29 juin 2026" | Filter in `isPedigreeWatermark` |
| Multi-line cellen (lange namen + studbook op aparte regels) | NIXON VAN'T / MEULENHOF / bwp | Per-kolom-tracking in `mergeMultiLineCells`, studbook-token als speciale uitzondering (mag over grotere regel-afstand mergen) |
| Unicode-letters in moeder-namen | KROKUSBLÜTE (Ü) | `\p{Lu}` Unicode-property in `damParaRegex` met `/u` flag |
| Typografische apostroffen in regex-matches | "Fille d'ACORADO" met `'` | Regex matched `Fille\s+d\S` (laxer) |

---

## Bekende risico's / openstaand

- **`maternal_line` is opgeslagen maar nog NIET zichtbaar in de UI.** De
  data zit veilig in de DB maar de LotPage / cockpit hebben (nog) geen
  component die hem toont. Aparte UI-sessie nodig om er een blok van te
  maken (voorstel: onder de PedigreeTree, met collapse-knop).
- **Lot 43 mogelijk typfout in de PDF.** DB-naam: `CAN'T RESIST HOF TER
  BRUGGEN Z`. PDF-naam: `CAN'T RESIST OF TER BRUGGEN Z` (mist de `H`).
  "Hof ter Bruggen" is Nederlands en lijkt het meest waarschijnlijk
  correct. Geen actie genomen — DB-naam blijft staan. Frederik kan op
  fences.fr of bij de eigenaar verifiëren.
- **7 lots met ontbrekende diacrieten in DB-naam.** `NENUPHAR` /
  `NERON` / `L'AMITIE` / `CHENEE` / `NOE` / `NOUMEA` / `TRESOR` zijn in
  de DB zonder accent opgeslagen. Niet aangeraakt door deze import.
- **41 lots missen tekst voor moederlijn-generatie 4** en 42 lots missen
  de familie-samenvatting. Dat is GEEN parser-bug — de PDF zelf bevat
  voor die paarden geen 4e-generatie tekst of geen samenvatting. Het is
  echte missende data.

---

## Verificatie

- **Parser-output** (`data/fences-selection-2026-pdf-enrichment.json`,
  372 KB): handmatig gecontroleerd op 5 sample-lots (1, 10, 30, 50, 70)
  en op de drie probleemgevallen (lot 19 NIFRANE, lot 25 NOGARO, lot 5
  DIA BELLA). Alle correct.
- **Migratie 0029** geverifieerd via `information_schema`: kolom is
  `jsonb`, `is_nullable = YES`.
- **Import** in twee fases: dry-run op 1 lot → dry-run op alle 76
  (0 conflicten) → COMMIT (76 rows updated).
- **Post-commit DB-query**: 76/76 hebben `pedigree`, 76/76 hebben
  `maternal_line`, 74/76 hebben volledige 3-gens (8 overgrootouders).
- **Build-check**: `npm run build` slaagt — geen frontend-impact, want
  geen React-componenten gewijzigd.

---

## Rollback

Als deze import om wat voor reden ook teruggedraaid moet worden:

1. **Pedigree wissen** (zet 76 lots terug op de pre-import staat —
   pedigree was overal `null`):
   ```sql
   update lots set pedigree = null
     where collection_id = 'a3c9ac43-25b9-46e1-a32f-c936cc378bc0';
   ```
2. **Maternal_line wissen** (idem):
   ```sql
   update lots set maternal_line = null
     where collection_id = 'a3c9ac43-25b9-46e1-a32f-c936cc378bc0';
   ```
3. **Migratie 0029 zelf** zou je in theorie ook kunnen terugrollen met
   `alter table lots drop column maternal_line;`, maar dat is alleen
   nodig als je het concept volledig wil afblazen. De kolom is nullable
   en kost niets als hij leeg staat.

Backup van 22 juni is beschikbaar via Supabase Dashboard mocht een
ruwere restore nodig zijn.

---

## Volgende stappen (apart)

- Eventueel **`birth_info` als kolom op `lots`** + UI-vermelding.
- **Parser-script herbruikbaar maken voor toekomstige Fences-catalogi**:
  de SELECTION 2027, SERVICE 2026, ELITE 2026 zullen waarschijnlijk
  dezelfde layout hebben (sjabloon-document van het zelfde drukker).
  Enige wijzigingen die nodig zouden kunnen zijn: page-watermark-tekst
  (datum verandert per jaar) en `COLLECTION_ID` in de importer.

---

## Vervolg in dezelfde sessie: UI-zichtbaar via PedigreeTexts

Na de eerste import bleek `maternal_line` in een eigen kolom te staan
zonder UI-koppeling. UI-onderzoek wees uit dat een bestaande component
`PedigreeTexts` (`src/components/PedigreeTree.jsx:131`) precies het
gewenste patroon biedt — klapbare blokken Père / 1ère / 2ème / 3ème /
4ème mère met editen, slepen-om-te-markeren — maar leest `text`-velden
ON DE pedigree-knopen (`pedigree.dam.text` etc.), zoals de Vente de
Service 19/06/2026 al gebruikt.

Frederik koos hergebruik van die bestaande UI boven een nieuw apart
blok. Implementatie:

- **Importer-script** uitgebreid om de PDF-tekst rechtstreeks in de
  pedigree-knopen te plaatsen:
  - `sire_description` → `pedigree.sire.text`
  - `maternal_line[1..3]` → `pedigree.dam[.dam[.dam]].text`
  - `maternal_line[4]` → nieuwe knoop op `pedigree.dam.dam.dam.dam`
    met naam-extractie uit de tekst (eerste `NAAM (f. …)` patroon)
  - `maternal_line.summary` → geappend aan diepste laag met
    `\n\n— Famille —\n` visuele separator
- **Slim-merge** uitgebreid: `text`-velden volgen dezelfde regel
  (leeg → vullen, gelijk → niets, verschillend → DB behouden + log).
  `highlights`-array (Frederiks markeringen) wordt nooit overschreven.
- **Her-import** uitgevoerd op productie: 76/76 lots krijgen
  `pedigree.sire.text` (Père) + `pedigree.dam.text` (1ère) +
  `pedigree.dam.dam.text` (2ème), 67/76 `.dam.dam.dam.text` (3ème),
  35/76 `.dam.dam.dam.dam.text` (4ème met geparste naam). 0 conflicten.
- **Migratie 0030** (`alter table lots drop column maternal_line`)
  toegepast op productie — kolom is redundant geworden. Data zit nu
  in `lots.pedigree`; geen verlies.

**Wat Frederik nu in de browser kan testen** (https://veiling-pro.vercel.app):
op LotPage van een lot in SELECTION 2026 verschijnen onder de pedigree-
bracket-tree de 5 klapbare blokken Père + 4 moeders + familie-
samenvatting. Op CockpitPage staan dezelfde blokken in de "Voorouders"-
Card in kolom 2.
