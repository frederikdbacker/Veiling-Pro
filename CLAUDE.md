# Werkwijze — veiling-pro

Dit bestand wordt elke sessie automatisch ingeladen. Het legt vast hóé er in
dit project gewerkt wordt. Overgenomen en aangepast van de werkwijze van het
fei-system-project (bevestigd 18 mei 2026).

## Wie is de gebruiker (Frederik)

- **Niet-technisch**: kan geen code lezen of schrijven. Termen als
  "component", "endpoint", "migratie" zijn abstract — eerste keer dat een
  term valt: één korte zin uitleg.
- **Eén stap per keer**: nooit meerdere stappen tegelijk geven. Doe stap 1,
  wacht op bevestiging, dan stap 2.
- **Visuele bevestiging** na elke stap ("zie je nu X in je scherm?").
- **Big-picture denker**: begrijpt het doel, vertrouwt op Claude voor het hoe
  — mits één stap per keer en overzicht bewaakt.
- **Stuurt op werkstroom-niveau**: praat met hoofd-Claude, niet met details.
- **Frederik is de finale review-instantie** via visuele tests. Geen extra
  AI-controlelaag erboven; bewaking = deterministische checks + zijn tests.
- **Voorkeur**: eenmalig goede setup boven dagelijks gedoe.
- **Geen snelle fix**: altijd de meest solide, duurzame oplossing kiezen —
  ook als dat nu meer werk kost. Een snelle workaround die later meer
  problemen of dagelijks werk geeft is niet acceptabel. Bij twijfel tussen
  "snel klaar" en "robuust": altijd robuust, en dat kort motiveren.

## De 10 werkmethode-principes

1. **Diagnose vóór fix** — root cause via logs/output/DevTools, nooit gissen.
   Eén extra ronde om exacte foutoutput vragen is beter dan een fix op aannames.
2. **Bestandscontext verplicht** — nooit een bestand wijzigen zonder eerst de
   volledige huidige inhoud te hebben gezien. Uitzondering: compleet nieuwe
   bestanden.
3. **Direct bewerken + git als terugrol** — dit is een "code"-omgeving. Geen
   patch-scripts; wel altijd via een feature-branch zodat terugrollen kan.
4. **Werkcadans** — elke substantiële afronding eindigt met:
   `Getest: X · Nog niet getest: Y · Volgende stap: Z`.
   Nooit stappen bundelen die sequentieel moeten.
5. **Referentie-documenten als één set** — `CLAUDE.md` (werkwijze) en
   `PROJECT_STATUS.md` (stand) worden samen bijgewerkt op dezelfde datum,
   ook als één van de twee inhoudelijk niet verandert.
6. **Plan vóór elke nieuwe feature** — bij elke substantiële taak (nieuwe
   pagina, nieuwe adapter, schemawijziging, meervoudige bestandswijzigingen):
   eerst een kort plan tonen, Frederik keurt goed of stuurt bij, dan pas
   bouwen.
7. **Audit-rapport in gewone taal** aan het eind van élke substantiële
   sessie — wat is gewijzigd, wat kan misgaan, wat moet Frederik visueel
   controleren, hoe terugrollen. Spontaan, zonder dat hij erom vraagt. Geldt
   voor alle werk (ook scraper-pulls, DB-wijzigingen, config), niet enkel
   frontend-code.
8. **Back-up vóór elke database-migratie / schemawijziging** — Frederik moet
   expliciet bevestigen dat de Supabase-export/back-up gemaakt is voordat een
   schemawijziging draait. Geen uitzonderingen.
9. **Build-check vóór elke commit** (deterministisch, geen AI):
   `npm run build` moet zonder errors slagen. Resultaat in gewone taal melden
   vóór de commit. Faalt de check → NIET committen, eerst fixen.
10. **Audit-rapport ook als markdownbestand** in `docs/audits/` met datum +
    kort thema in de naam, bv. `docs/audits/2026-05-18-url-import.md`.
    Spontaan aangemaakt vóór "klaar" gemeld wordt. Doel: zoekbare
    geschiedenis van wat er per sessie wijzigde.

## Projectspecifieke aandachtspunten

- **Stack**: Vite + React + Supabase. Geen Python/FastAPI/Render. Build-check
  is altijd `npm run build`.
- **Schema-drift**: de live Supabase-DB gebruikt `collections`/`collection_id`
  (niet `auctions`/`auction_id`); `lots.lot_type_id` is verplicht. Zie de
  bron-README in `scripts/lib/sources/` en het projectgeheugen.
- **Commits/push**: alleen wanneer Frederik daarom vraagt. Altijd op een
  feature-branch, nooit direct op `main`. Commitberichten in het Nederlands.
- **Infrastructuur-keuzes met meerdere opties**: niet vragen "welke wil je?",
  maar advies geven + kort motiveren; Frederik bevestigt of stuurt bij.

## Bewust (nog) niet overgenomen

- De drie sub-agents (builder / data-pipeline / editorial) uit fei-system zijn
  FEI-specifiek. Een eigen variant voor veiling-pro is een aparte beslissing
  en wordt pas ingericht na expliciet akkoord — niet automatisch.
