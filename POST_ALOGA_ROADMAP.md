# POST_ALOGA_ROADMAP — Veiling-Pro iteratie mei 2026

**Aangemaakt: 5 mei 2026 (vóór Aloga-veiling)**
**Laatste update: 5 mei 2026 (avond — versie met 27 items)**
**Bedoeld voor: eerste grote iteratie ná Aloga Auction 2026**

---

## Doel van dit document

Tijdens de voorbereidende dag op 5 mei zijn aanpassingen geformuleerd in
chat. De keuze is om die *niet* meer vóór de veiling door te voeren, maar
ze als één grote iteratie aan te pakken in de week(en) erna. Dit document
bevat alles wat nodig is om die iteratie schoon te starten — zonder dat de
chat-historie nog opgeslagen of teruggelezen hoeft te worden.

Bij start van de iteratie: dit document wordt het uitgangspunt voor de eerste
Claude Code-sessie.

---

## Belangrijke wijziging — project staat nu in iCloud Drive

> **UPDATE 6 mei 2026 — deze sectie is achterhaald.** De iCloud-verhuis
> van 5 mei is op 6 mei teruggedraaid: project staat weer in
> `~/veiling-pro/` (lokale map, niet in iCloud) met GitHub als
> sync-route tussen Mac mini en MacBook. Zie HANDOVER.md gotcha #6 en
> `reports/2026-05-06_fase-0-icloud-naar-git.md` voor toelichting.
> De drie iCloud-valkuilen hieronder (node_modules-sync, .git-conflicten,
> file-watching) zijn niet meer van toepassing, maar blijven hieronder
> voor historische referentie.

**Tot eind april 2026** stond `~/veiling-pro/` op de Mac mini, niet in iCloud.
Sync tussen Mac mini en MacBook ging via GitHub (zie HANDOVER.md gotcha #6).

**Sinds 5 mei 2026** staat de projectmap in iCloud Drive. Dit moet
weerspiegeld worden in de drie projectdocumenten zodra de iteratie start:

- `HANDOVER.md` gotcha #6 → herschrijven of verwijderen
- `DEVELOPER_SETUP.md` → padverwijzingen controleren
- `MASTER_PROMPT.md` → indien er padverwijzingen staan, bijwerken

**Eerste actie in de eerste iteratie-sessie:** bevestig met `pwd` in de
terminal het exacte nieuwe pad. Mogelijke kandidaten:
- `~/Library/Mobile Documents/com~apple~CloudDocs/veiling-pro/`
- `~/Documents/veiling-pro/` (indien "Desktop & Documents in iCloud" aanstaat)
- Een aangepaste locatie

### Bekende valkuilen — Node.js-project in iCloud Drive

Drie zaken om in de eerste sessie meteen aan te pakken:

1. **`node_modules`** — grote map (vaak honderden MB tot meer dan een GB).
   iCloud probeert die te syncen, wat traag is en je iCloud-quota onnodig
   belast. Standaardoplossing: hernoem `node_modules` naar `node_modules.nosync`
   en maak een symlink, of gebruik een per-machine externe map. We bepalen de
   exacte aanpak in sessie 1.
2. **`.git`-conflicten** — als beide Macs tegelijk gepulled hebben en iCloud
   syncet ondertussen, kunnen `.git/index.lock` en object-files in conflict
   raken. Vuistregel: altijd op één machine tegelijk werken, en gebruik
   `git status` direct na elke iCloud-sync-pauze.
3. **File-watching tijdens `npm run dev`** — Vite kan traag reageren als
   iCloud bestanden voortdurend in en uit cachet. Symptoom: hot-reload werkt
   met vertraging. Oplossing meestal: `.nosync` op de juiste mappen, of
   tijdens dev iCloud-sync pauzeren via Finder.

Deze drie items vormen samen **Fase 0** van de iteratie — niet skippen.

---

## De volledige stapel — 27 aanpassingen

Onderstaande lijst is het resultaat van de chat-sessie van 5 mei 2026. Elke
nuance en beslissing is hier opgenomen. Bij twijfel tijdens implementatie:
gebruik dit document als bron van waarheid, niet de chat-historie.

### 1. Sterrenrating 1–5

- Hele sterren, optioneel (paard mag rating-loos zijn)
- Vijf klikbare sterretjes, géén dropdown-menu
- Eén rating per paard (geen aparte sportief/commercieel)
- Zichtbaar en bewerkbaar op AuctionPage per rij, op LotPage, in de cockpit
- Sorteerbaar op AuctionPage
- Representeert de inschatting van Frederik en het organisatiecomité

### 2. Bulk-startbedrag vanuit AuctionPage

- Knop bovenaan AuctionPage opent een eenvoudige modal
- In de modal: één invulveld per actief lot-type (springen €X, dressuur €Y)
- Alleen lege startbedragen worden ingevuld; bestaande blijven onaangeroerd
- Per lot blijft individueel corrigeren mogelijk via AuctionPage-rij
- Lot-type is verplicht (zie #13), dus geen "overige"-veld nodig

### 3. Vorig/volgend lot-navigatie bovenaan LotPage

- Nu staat de navigatie alleen onderaan; je moet ver scrollen
- Toevoegen: identieke navigatie helemaal bovenaan LotPage
- Onderaan blijft staan zoals nu

### 4. Video-link-veld zonder waarschuwing

- De huidige "geen video"-waarschuwing moet weg
- Wanneer er geen videolink is ingevuld, geen melding meer
- **Pre-check:** verifieer in Supabase Dashboard → Table Editor → `lots` of
  er al een video-URL-kolom bestaat (bv. `video_url`, `youtube_url`).
  Migratie 0005 voegde drie URL-velden toe; check welke. Indien geen
  video-veld bestaat: nieuwe migratie maken.

### 5. Veiling-rundown vóór lot 1

- Vrij tekstveld (geen vaste rubrieken), bewerkbaar op AuctionPage
- Bij nieuwe veiling: standaardsjabloon automatisch ingevuld
  (veilingcondities, spotters voorstellen, aankondigingen)
- Per veiling aanpasbaar
- Zichtbaar in de cockpit als startscherm vóór lot 1
- Geen afvink-mechanisme nodig

### 6. Charity-lot

- Optioneel weggeef-lot vóór lot 1, eigen cockpit-flow
- Eigen biedstap-systeem (zelfde staffel-structuur als gewone lots, maar
  losstaand van de veiling-staffels)
- Eigen beschrijving, eigen minimumprijs, eigen verwachte prijs
- Mag in het systeem en op een pagina getoond worden, maar **telt niet mee
  in de omzetstatistieken** van de veiling

### 7. Notitievelden herstructureren

- Huidige drie velden (catalogus / video / organisatie) dekken de lading niet
- Catalogus en video → weg
- Nieuwe rubrieken: **familie / resultaten / kenmerken / organisatie /
  bijzonderheden**
- Organisatie blijft bestaan, andere zijn nieuw
- Krijgen rich-text-editor (zie #27)

### 8. Land-veld bij klanten

- Type-ahead dropdown met letterprong
- Engelse landnamen
- Vlaggetjes naast de landnaam in de dropdown en in het klant-overzicht
- Zoekbaar op ISO 3166-1 alpha-3 (bv. "BRA" → Brazilië)

### 9. Geboortejaar + leeftijd gecombineerd op LotPage

- Weergave: "2019 / 7 jaar"
- Berekend op basis van huidig kalenderjaar

### 10. Scrape-script vult "Auction page"-veld

- Veld nu "Externe link" → hernoemen naar **"Auction page"**
- Scrape-script moet bron-URL per paard ophalen en automatisch in dit veld
  invullen
- Indien mogelijk retroactief toepassen op de Aloga 2026-lots
- Splitst zich in 10a (scrape-uitbreiding, Fase 6) en 10b (UI-rename, Fase 1)

### 11. Hengst-gekeurd-vinkje + stamboek-dropdown

- Verschijnt alleen wanneer geslacht = hengst
- Vinkje "gekeurd" — standaard uit
- Wanneer aangevinkt: stamboek-dropdown verschijnt
- Meerdere stamboeken mogelijk per hengst
- Volgorde in dropdown: **veelgebruikt eerst**, alfabetisch eronder
  (voorstel: BWP, KWPN, SBS, HANN, OLD, SF, Z bovenaan)
- Volledige lijst (alles in HOOFDLETTERS):

  HANN, WEST, OLD, OS, MV, DSP, SF, SBS, Z, BWP, AES, KWPN, NRPS, SWB,
  DWB, NWB, SI, CCDM, ISH, ESHB, BE/SIES, BH, CDE, SLS, SCSL, AWHA,
  RHEIN, BAD-WU, PZHK, SATHU, ZFDP

- **Zichtbaarheid:**
  - LotPage: vinkje + dropdown volledig bewerkbaar
  - Cockpit: alleen tekst "Gekeurd [stamboek]" — geen dropdown
  - AuctionPage-rij: "Hengst ggk" achter het geslacht (kleine letters voor "ggk")

### 12. Lotnummer vs veilingvolgorde

- Onderscheid maken tussen catalogusnummer (vast, van veilingsite) en
  veilingvolgorde (presentatie-volgorde tijdens de veiling)
- Drag-and-drop op AuctionPage met conditioneel gedrag:
  - Wanneer collectie al lotnummers heeft: alleen veilingvolgorde
    herschikbaar; lotnummers blijven vast
  - Wanneer collectie nog geen lotnummers heeft: drag-and-drop schikt
    beide tegelijk (volgorde wordt direct het lotnummer)
- Cockpit-statusbalk toont **veilingvolgorde** ("Paard 12 / 24")
- Catalogusnummer als kleinere context erbij (bv. "Cat. nr 17")

### 13. Lot-type verplicht + auto-afleiden

- Geen paard zonder lot-type — waarschuwing wanneer ontbreekt
- Auto-afleiden bij import:
  - Geen geboortejaar bekend → vermoedelijk **embryo**
  - Geboortejaar = lopend kalenderjaar → **veulen**
- Auto-toegekende waarden zichtbaar markeren ("automatisch toegekend,
  klik om te wijzigen")
- **Pre-check:** verifieer in Supabase → `lot_types` tabel of "veulen" en
  "embryo" al als seed-rows bestaan. Zo niet: nieuwe migratie.

### 14. Geïnteresseerde klanten — Onsite / Online / Phone

- Drie modi, standaard **Onsite**
- Voor Onsite: volledige formulier zoals nu (inclusief seating)
- Voor Online: zelfde formulier minus seating (zit niet in de zaal)
- Voor Phone: idem zonder seating
- Modus is **per-veiling**, niet per-lot (iemand die online zit voor lot 5,
  zit ook online voor lot 12 dezelfde avond)
- Tekst-label achter naam: "Jan Janssens (Onsite)" / "(Online)" / "(Phone)"
- Modus wijzigbaar op LotPage; **niet** in de cockpit (cockpit toont alleen
  het label, geen switch)
- Hoort architectonisch bij `client_auction_seating`-tabel — modus is
  een per-klant-per-veiling-attribuut

### 15. Catalogustekst + EquiRatings samenvoegen tot één blok

- Op LotPage staan nu twee aparte blokken: catalogustekst en EquiRatings
- Andere veilingsites hebben geen EquiRatings-blok — daarom samenvoegen
- Aanpak: **simpele concatenatie** in één geschreven-info-blok
  (catalogustekst boven, EquiRatings-info eronder, witte ruimte ertussen)
- Scrape-logica blijft voorlopig zoals ze is (de twee blokken apart vullen)
- Wordt herzien naarmate meer veilingcollecties ingeladen worden — pas
  dan weten we of het script aangepast moet worden

### 16. UI-fix lottype-uitlijning op LotPage

- Lottype-dropdown staat lager dan lotnummer/startprijs/reserveprijs
- Lottype-label is lichtgrijs en niet bold, terwijl andere labels in dat
  blok wit en bold zijn
- Beide moeten gecorrigeerd worden: lottype op dezelfde hoogte als de
  andere velden, label wit en bold zoals de rest

### 17. Volledige refactor terminologie + breadcrumbs

- **Termen-hiërarchie:** Veilinghuizen → Veilingen → **Collectie** → Lot
- "Collectie" vervangt wat nu AuctionPage heet (was eerder onduidelijk
  benoemd)
- **Verregaand uitvoeren** — Frederik koos expliciet voor diepe refactor
  in plaats van alleen UI-labels:
  - UI-labels (paginatitels, koppen, knoppen)
  - URL's (`/auctions/:id` → `/collections/:id`)
  - Componentnamen (`AuctionPage` → `CollectionPage`, etc.)
  - Database-tabellen (`auctions` → `collections`)
  - Bijhorende kolomnamen waar van toepassing (`auction_id` → `collection_id`)
- **Breadcrumbs** bovenaan elke pagina:
  "Aloga › Aloga Auction 2026 › Collectie › Master of Paradise"
- Aparte sessie waard (zie Fase 1.5) — raakt 12 migraties, alle queries,
  componenten, RLS-policies en de cockpit-flow

### 18. Externe links als logootjes in de cockpit

- HippoMundo, HorseTelex en Auction page als klikbare logootjes
- Positie: tussen basisinformatie van het paard en pedigree
- Alleen tonen wanneer URL ingevuld is — geen lege/grijze placeholders
- **Logo-strategie:**
  - HippoMundo en HorseTelex: vaste logo's, in de codebase meegeleverd
  - Auction page: dynamisch logo per veilinghuis — nieuw veld
    `auction_houses.logo_url` toevoegen, één keer uploaden per huis
- **Logo-styling:** wit-zwart, passend bij de cockpit-interface
  (geen knalkleurige vierkante logo's)

### 19 + 20. Spotter-toevoegen geeft foutmelding (samengevoegd)

- *Status: open issue, exacte foutmelding volgt later*
- Frederik kan momenteel geen spotters toevoegen via de spotter-UI
- Items 19 en 20 uit eerdere documentversie blijken hetzelfde probleem
- Aanpakken zodra Frederik de exacte foutmelding (screenshot of tekst)
  doorgeeft
- Niet inplannen in een fase tot we weten wat er aan de hand is — kan
  een snelle bug-fix zijn of een diepere herstructurering

### 21. Klantenpagina per veiling

- Nieuwe pagina onder de veiling: bv. `/collections/:id/clients`
- Toont alle klanten die voor déze specifieke veiling relevant zijn
- Per rij: dropdown om de klant aan **één of meerdere lots tegelijk** te
  linken (checkbox-lijst van alle lots in de veiling)
- Toevoegen van nieuwe klanten direct op deze pagina — wordt automatisch
  toegevoegd aan de globale klantenlijst (zie #22) én gekoppeld aan deze
  veiling
- Architectonisch: gebruikt bestaande `clients` + `lot_interested_clients`
  + `client_auction_seating`-tabellen

### 22. Globale klantenlijst-overzichtspagina

- Nieuwe pagina: bv. `/clients`
- Tabelvorm met basisinformatie per rij: **naam, land (vlaggetje), foto**
- Foto-upload bij elke klant — Supabase Storage-bucket aan te maken voor
  klant-foto's (en spotter-foto's, zie #22b)
- Inline bewerkbaar (klik op cel, type, auto-save) — geen aparte
  klant-detailpagina nodig
- Geldt als de centrale plek waar je klanten beheert over alle veilingen
  heen

### 22b. Foto-upload bij spotters

- Spotters krijgen ook een foto-upload-veld (`SpottersField` op
  AuctionPage / `SpottersStrip` in cockpit)
- Zelfde Supabase Storage-bucket als #22, of een aparte — te bepalen
  in implementatie-sessie
- Visueel handig in de cockpit om snel een spotter te herkennen

### 23. Cockpit-knoppen vereenvoudigen

- Drie-knop-flow (IN DE PISTE → START BIEDEN → HAMER) wordt **één knop**
- Hoofdknop: hernoemd naar **"VERKOCHT"**
- **Tijdsregistratie:** "gem. duur per lot" wordt berekend als de tijd
  tussen twee opeenvolgende drukken op VERKOCHT (vorige hamer → deze hamer).
  Eenvoudiger maar nog steeds nuttige metriek.
- **Keuzescherm na VERKOCHT blijft** — exact zoals nu: "in zaal" /
  "niet verkocht" / "online" — die drie blijven dus opties
- **Live-lot visueel gemarkeerd:** behoud van zichtbare aanduiding
  welk lot momenteel live is (vs. wachtend) — Frederik wil dat blijven zien

### 24. Vastgezette infobalk in de cockpit (sticky)

- Sticky balk **bovenaan** in de cockpit, blijft zichtbaar tijdens scrollen
- Inhoud: **lotnummer, naam, leeftijd, minimumbedrag, vader, moedersvader**
- Eén balk — sessie-statistieken (omzet, gem. duur, voorspeld einde) horen
  hier **niet** bij; die mogen elders in de cockpit staan
- Apparaat-context: cockpit wordt op MacBook gebruikt (mogelijk ook iPad —
  uit te tekenen in implementatie)

### 25. Extern apparaat (knoppen / voetpedaal / Bluetooth)

- *Status: te verkennen ná Aloga 5 mei*
- Concept: fysiek apparaat aan laptop (USB of Bluetooth) om VERKOCHT en
  eventuele andere acties blind te bedienen, zonder oog van de zaal te halen
- Opties variëren van wireless presenter (~€30) tot Stream Deck (~€150)
- Geen tijdsinschatting, geen fase — beslissing pas nadat Frederik tijdens
  Aloga heeft geobserveerd of het oog-naar-scherm-probleem groot genoeg is
- Mogelijk in spanning met #23 (drie acties via fysieke knoppen brengt
  knop-complexiteit terug, zij het tactiel) — bewust afwegen na ervaring

### 26. Spotter vastleggen bij verkoop

- In het verkoop-keuzescherm (na drukken op VERKOCHT, zie #23) ook een
  veld toevoegen: **welke spotter heeft het winnende/laatste bod gemeld**
- Dropdown met de spotters van deze veiling
- Wordt opgeslagen bij het verkoopresultaat van het lot
- Maakt achteraf statistieken mogelijk over welke spotters de meeste
  verkopen genereren — relevant voor latere veilingen

### 27. Rich-text-editor in notitievelden op LotPage

- **Locatie:** alleen de vijf notitievelden uit #7 — familie, resultaten,
  kenmerken, organisatie, bijzonderheden
- **Opties:** bold, onderlijnen, highlight in vier kleuren (geel, groen,
  roze, blauw)
- Knoppenbalk boven elk veld met deze opties
- Auto-save behouden zoals bij de huidige `NoteField` (debounce 800ms)
- **Technische aanpak:** rich-text-editor zoals TipTap. Tekst wordt in de
  database opgeslagen als HTML of structured JSON (niet meer plat) — dit
  is een afweging om in de implementatie-sessie te bevestigen
- Bouwen als één hergebruikbaar component dat in alle vijf velden
  ingezet wordt
- **Niet** voor andere tekstvelden in het systeem (rundown, charity-
  beschrijving, catalogustekst etc.) — daar blijven gewone tekstvelden
- Past bij Fase 2 omdat het samen met de notitievelden-herstructurering
  van #7 gebeurt

---

## Fasering met tijdsinschattingen

Tijdsinschattingen zijn **wandklok-tijd**, inclusief plan-mode, klein-stappen-
werkwijze, migratie-bevestiging, visuele check, build-check en audit-rapport
zoals voorgeschreven in MASTER_PROMPT.md.

### Fase 0 — iCloud-setup

> **UPDATE 6 mei 2026 — Fase 0 voltooid via git/GitHub-route.**
> Stappen "los `node_modules`-sync op" en "iCloud-vertraging testen"
> vervallen omdat het project niet (meer) in iCloud zit. Documentatie-
> updates en build/dev-checks zijn wel uitgevoerd. Zie audit-rapport
> `reports/2026-05-06_fase-0-icloud-naar-git.md`. Volgende: Fase 1.

**Geschat: 30-60 min · 1 sessie**

- Bevestig nieuwe pad naar projectmap
- Los `node_modules`-sync op (`.nosync` of symlink-aanpak)
- Werk HANDOVER.md gotcha #6, DEVELOPER_SETUP.md, MASTER_PROMPT.md bij
- Test `npm run dev` werkt vlot zonder iCloud-vertraging
- Audit-rapport schrijven

### Fase 1 — Quick wins

**Geschat: 2 uur · 1 sessie**

- (3) Nav bovenaan LotPage
- (9) Geboortejaar + leeftijd combineren
- (4) Video-waarschuwing weg + Supabase-kolomcheck
- (10b) "Externe link" hernoemen naar "Auction page"
- (16) UI-fix lottype-uitlijning op LotPage

Vijf kleine ergernissen weg in één sessie. Voelt meteen lichter aan.

### Fase 1.5 — Grote rename + breadcrumbs

**Geschat: 2-3 uur · 1 aparte sessie**

- (17) Volledige refactor: AuctionPage → CollectionPage, `auctions`-tabel →
  `collections`, alle URL's en componenten meegerefactord, breadcrumbs op
  elke pagina toegevoegd

**Waarom apart en vóór Fase 2?** Alle features die we daarna bouwen, bouwen
dan op de nieuwe namen. Andere volgorde betekent: features bouwen op
`auctions` en daarna alles omdopen — dubbel werk en meer kans op fouten.

Risicovolle sessie — extra zorgvuldig met:
- Database-migratie testen op een staging-snapshot vóór productie
- Alle FK-verwijzingen (12 migraties bevatten `auctions`)
- RLS-policies opnieuw aanleggen
- Alle queries in de codebase doorlichten
- Vercel-deployment goed checken na de push

### Fase 2 — Info-structuur

**Geschat: 5-7 uur · 2 sessies**

Volgorde belangrijk vanwege migratie-efficiency:

- (13) Lot-type verplicht + auto-afleiden — fundament
- (7) Notitievelden herstructureren — schema-werk samen met 13 in één migratie
- (27) Rich-text-editor in notitievelden — bovenop #7, één hergebruikbaar
  component voor alle vijf velden
- (1) Sterrenrating
- (11) Hengst-gekeurd + stamboek
- (15) Catalogustekst + EquiRatings samenvoegen

Schatting opgewaardeerd ten opzichte van eerdere versie omdat de
rich-text-editor (#27) ongeveer 2-3 uur extra werk vraagt bovenop de
herstructurering zelf.

### Fase 3 — Klantenbeheer (uitgebreid)

**Geschat: 4-6 uur · 2 sessies**

Alle klant-gerelateerde items samen — één migratie voor het schema, één
UI-sessie voor de complete klantenervaring:

- (8) Land-veld bij klanten
- (14) Klant-modus Onsite/Online/Phone
- (21) Klantenpagina per veiling met multi-lot-koppeling
- (22) Globale klantenlijst-overzichtspagina met foto's
- (22b) Foto-upload bij spotters
- (2) Bulk-startbedrag — past bij collectie-niveau acties
- (18) Externe links als logootjes in cockpit + logo-veld bij auction_houses

Setup-stap: Supabase Storage-bucket(s) aanmaken voor klant- en
spotter-foto's. Niet als apart item maar als onderdeel van deze fase.

### Fase 4 — Cockpit-vernieuwing

**Geschat: 4-6 uur · 2 sessies**

Cockpit-flow ingrijpend bijwerken — drie samenhangende items:

- (23) Cockpit-knoppen vereenvoudigen (één VERKOCHT-knop)
- (24) Vastgezette infobalk bovenaan
- (26) Spotter vastleggen bij verkoop
- (5) Veiling-rundown met sjabloon
- (12) Lotnummer vs veilingvolgorde + drag-and-drop

### Fase 5 — Charity-lot

**Geschat: 2-3 uur · eigen sessie**

- (6) Charity-lot — apart houden om in elkaar schuiven met andere features
  te vermijden. Zwaarste van de stapel — raakt schema, cockpit-flow én
  statistieken.

### Fase 6 — Scrape-uitbreiding

**Geschat: 1-2 uur · gekoppeld aan latere scrape-sessie**

- (10a) Scrape-script: bron-URL ophalen + retroactief Aloga 2026

Niet doen tot je weer aan scrape-werk begint.

### Open issues — geen fase, oppakken zodra context binnen is

- (19+20) Spotter-toevoegen geeft foutmelding — wacht op exacte foutmelding
  van Frederik. Bij voorkeur in een aparte korte sessie aanpakken, niet
  vermengen met geplande features. Mogelijk wil je dit als allereerste
  doen ná Fase 0 omdat het je nu al hindert.
- (25) Extern apparaat verkennen — concept-evaluatie ná Aloga, geen
  implementatie tot je beslist of het waardevol is

---

## Totale wandklok-schatting

Ruwweg **22-30 uur**, verdeeld over **9 à 12 sessies van 2-3 uur**.

De grote brokken zitten in Fase 1.5 (rename), Fase 2 (info-structuur +
rich-text-editor), Fase 3 (klantenbeheer), Fase 4 (cockpit-vernieuwing) en
Fase 5 (charity). Fase 1 is bewust een "quick wins"-sessie — overweeg als
avond-warming-up vóór een grotere sessie.

---

## Openingsprompt voor de eerste Claude Code-sessie

Te plakken in Claude Code na `cd [nieuw pad]/veiling-pro && claude`:

> "Lees PROJECT_STATUS.md, MASTER_PROMPT.md, DEVELOPER_SETUP.md en
> POST_ALOGA_ROADMAP.md voor context. Werkwijze uit deze documenten geldt
> onverkort. De gebruiker is niet-technisch, dus klein-stappen-werkwijze
> met visuele bevestiging na elke stap.
>
> We starten Fase 0: iCloud-setup. Bevestig eerst het exacte huidige pad
> van de projectmap, controleer of `npm run dev` vlot werkt, en doe een
> voorstel voor de aanpak van `node_modules` in iCloud. Daarna werken we
> HANDOVER.md gotcha #6 bij en updaten we de andere documenten waar nodig.
>
> Nadat Fase 0 is afgerond met audit-rapport, vraag ik bevestiging voor
> Fase 1."

Bij latere sessies vervang je het Fase 0-blok door de volgende fase.

---

## Pre-fase checks die je nu al kan doen

Indien je tussen 5 mei en de start van de iteratie 5 minuten hebt en op
iPad of telefoon zit, kan je deze drie dingen al checken in Supabase
Dashboard. Helpt om Fase 1 en 2 sneller te laten verlopen.

1. **Tabel `lots` → kolommen** — staat er al een video-URL-kolom?
   (bv. `video_url`, `youtube_url`, `video`). Noteer de namen van de drie
   URL-velden uit migratie 0005. Relevant voor punt 4 en 10b.

2. **Tabel `lot_types` → rows** — welke 8 lot-types zijn er? Staan
   "veulen" en "embryo" erbij? Relevant voor punt 13.

3. **Tabel `client_auction_seating` → kolommen** — welke velden bestaan?
   Voor punt 14 moeten we mogelijk een kolom `bidding_mode` toevoegen
   (enum: onsite / online / phone).

Drie screenshots of korte notities volstaan.

---

## Wat NIET in deze stapel zit

Voor de volledigheid — deze items zijn in de chat besproken maar **niet**
in de stapel opgenomen, want ze waren al in orde of niet relevant:

- Visueel onderscheid Onsite/Online/Phone in de cockpit — Frederik gaf
  expliciet aan dat dit niet nodig is, alleen het tekst-label volstaat
- Trofeeëtje bij gekeurde hengsten — afgewezen, alleen tekst "gekeurd"
- Mode-switch in de cockpit voor klanten — afgewezen, alleen op LotPage
- "Overige"-veld in bulk-startbedrag-modal — overbodig na #13
- Knalkleurige logo's in de cockpit (#18) — afgewezen, wit-zwart enkel
- Klant-detailpagina (`/clients/:id`) — afgewezen bij #22, inline-bewerken
  in de tabel volstaat
- Sessie-statistieken in de sticky balk (#24) — afgewezen, mogen elders
  in de cockpit staan
- Rich-text-editor in andere velden dan de vijf notitievelden — afgewezen
  bij #27, om de scope beheersbaar te houden
- Cursief, lijstjes, lettergroottes in rich-text-editor — afgewezen bij
  #27, alleen bold/onderlijnen/highlight

---

**Slot.** Bij start iteratie eerst dit document herlezen, dan met de
openingsprompt naar Claude Code. Succes.
