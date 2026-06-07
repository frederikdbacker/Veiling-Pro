# Verbeterpunten na veiling — bundel + plan

**Datum:** 6 juni 2026
**Aanleiding:** Frederik wil na de veiling van gisteren vier verbeterpunten
bundelen. Dit document is de gebundelde wensenlijst + voorgesteld plan.
Nog **niet gebouwd** — eerst goedkeuren of bijsturen.

> Belangrijke vaststelling vooraf: twee van de vier punten zitten al in de
> code, maar verschenen gisteren **niet** tijdens de echte veiling door een
> verborgen voorwaarde. Het werk zit dus deels in "zichtbaar/bruikbaar maken"
> en niet alleen in "nieuw bouwen".

---

## Punt 1 — Spotter kiezen bij verkoop

**Wat je vroeg:** bij een verkoop ook kunnen aanduiden wélke spotter het bod
meldde, niet alleen de koper.

**Wat er nu is:** in de cockpit-hamermodal (`CockpitPage.jsx:755-771`) staat
al een "Spotter:"-dropdown, naast het koper-veld. De keuze wordt bij het lot
opgeslagen (`lots.spotter_id`).

**Waarom je het gisteren niet zag (oorzaak):** de dropdown verschijnt alléén
als er voor díé veiling spotters zijn toegekend. Waren er geen spotters
gekoppeld aan de veiling, dan zag je enkel het koper-veld.

**Voorstel:**
- Het spotter-veld **altijd** tonen in de hamermodal, ook als er nog geen
  spotters gekoppeld zijn — met de mogelijkheid om er ter plekke één toe te
  voegen (snel intypen → wordt aangemaakt en gekoppeld, net als bij de koper).
- Zo kun je tijdens de veiling altijd een spotter aanduiden, zonder vooraf de
  spotterslijst te moeten klaarzetten.

**Status:** klein werk (UI-aanpassing, geen databasewijziging).

---

## Punt 2 — Lege info-/kladblokvakken onderaan de cockpit

**Wat je vroeg:** vrije informatievakken om tijdens de veiling in te typen,
én — verfijnd in je antwoord — dat **niet-ingevulde** info-/kladblokvakken
**helemaal onderaan** in de cockpit komen te staan, zodat ze geen overbodige
ruimte innemen.

**Wat er nu is:** vaste blokken in vaste volgorde (Geïnteresseerden,
Catalogustekst, Mijn voorbereiding met 5 categorieën, "Opmerkingen verkoop",
EquiRatings). Lege blokken nemen nu nog steeds plaats in.

**Voorstel:**
1. **Eén vrij kladblok-veld** per lot toevoegen om tijdens de veiling in te
   typen (los van de vaste voorbereidingsvelden).
2. **Slimme volgorde:** info-/notitievakken die leeg zijn schuiven automatisch
   naar onderaan in de cockpit (of klappen samen tot een dunne regel), zodat
   gevulde info bovenaan blijft en de schermruimte efficiënt blijft.

**Open keuze (klein):** één kladblok-veld of meerdere? Voorstel: starten met
één; uitbreiden is later triviaal.

**Status:** middelgroot werk (1 databaseveld voor het kladblok + UI-herordening
in de cockpit).

---

## Punt 3 — Gemiddelde verkoopprijs per lottype

**Wat je vroeg:** gemiddelde verkoopprijs per lottype.

**Wat er nu is:** op de overzichtspagina (na afloop, `/…/summary`) staat onder
"Per lot-type" al per type: aantal, verkocht/niet, **gem €X** en totaal
(`CollectionSummaryPage.jsx:254-280`).

**Waarom je het gisteren niet zag (oorzaak):**
- Het blok verschijnt alléén bij **méér dan één** lottype
  (`groups.length > 1`, regel 171). Bij één type wordt het verborgen.
- Het staat op de **overzichtspagina na afloop**, niet **live in de cockpit
  tijdens** de veiling — en dat is waar je het wilde zien.

**Voorstel:**
- De gemiddelde verkoopprijs per lottype **live in de cockpit** tonen
  (meegroeiend tijdens de veiling), bv. in een compact blok of in de
  statusbalk, zodat je tijdens het hameren ziet hoe elk type presteert.
- Eventueel ook het overzichts-blok tonen bij één type (nu verborgen), zodat
  het cijfer ook bij een veiling met één type beschikbaar is.

**Status:** klein tot middelgroot werk (berekening bestaat al, het gaat om
plaatsen/tonen op de juiste plek; geen databasewijziging).

---

## Punt 4 — Lot als "afwezig" markeren

**Wat je vroeg:** tijdens de veiling (in de cockpit of op de lotpagina) een lot
als afwezig kunnen markeren, zodat het niet wordt aangeboden. Gedrag: **zichtbaar
maar gemarkeerd** (jouw keuze). Plek: je wil het op meerdere plekken kunnen
aanduiden.

**Wat er nu is:** er bestaat **geen** afwezig-/teruggetrokken-status op een lot.

**Voorstel:**
1. **Databaseveld toevoegen** (bv. `lots.is_withdrawn`, ja/nee).
2. **Markeren kan op twee plekken:** een knop/schakelaar op de lotpagina én in
   de cockpit (zodat je het ook last-minute tijdens de veiling kunt zetten).
3. **Gedrag van een afwezig lot:**
   - blijft zichtbaar in de lijst, met een duidelijk "afwezig"-label;
   - wordt **overgeslagen** door de cockpit-flow ("Volgend lot");
   - **telt niet mee** in de omzet- en gemiddelde-cijfers.

**Status:** middelgroot werk (1 databaseveld + UI op lotpagina en cockpit +
overslaan in cockpit + uitsluiten in de cijfers).

---

## Samenvatting + voorgestelde volgorde

| # | Punt | Aard | Omvang |
|---|------|------|--------|
| 1 | Spotter altijd kiesbaar bij verkoop | zichtbaar maken + inline toevoegen | klein |
| 3 | Gem. verkoopprijs per lottype live in cockpit | tonen op juiste plek | klein–middel |
| 2 | Kladblok-veld + lege vakken onderaan | nieuw veld + herordening | middel |
| 4 | Lot als afwezig markeren | nieuw veld + UI + logica | middel |

**Voorgestelde volgorde:** eerst 1 en 3 (snelle winst, geen databasewijziging),
daarna 2 en 4 (elk met een kleine, additieve databasewijziging).

**Werkwijze per punt:** databack-up vóór elke schemawijziging, plan per stap,
build-check vóór commit, alles op een feature-branch, visuele bevestiging na
elke stap.

**Open keuzes om te bevestigen:**
- Punt 2: één kladblok-veld (voorstel) of meerdere?
- Punt 3: live in een apart compact blok in de cockpit, of in de statusbalk?
