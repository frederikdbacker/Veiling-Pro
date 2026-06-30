# Ideeën-backlog — spotters, cockpit-fixes & Stream Deck

**Aangemaakt: 30 juni 2026 (Co-work) — parkeerdocument, nog niet gebouwd.**

Dit zijn Frederiks ideeën van 30 juni, uitgewerkt tot concrete opdrachten. Elk
punt is zo geschreven dat het later los naar Claude Code kan via
`PROMPT_TEMPLATE.md`. Volgorde = aanbevolen bouwvolgorde (blokkers en kleine
fixes eerst, samenhangende spotter-set daarna, Stream Deck als laatste/groot).

Zekerheidslabels: **[Zeker]** = geverifieerd in de code op 30 juni ·
**[Waarschijnlijk]** = sterke gevolgtrekking · **[Gokken]** = ingevuld gat.

> **Schema-waarschuwing voor Claude Code.** De live database gebruikt
> `collections` / `collection_id` en de spotter-junction heet
> **`collection_spotters`** (niet `auction_spotters`, zoals oudere docs nog
> zeggen). `lots` hangt aan een collectie via `collection_id` en aan een dag via
> `lots.collection_day_id` (migratie 0031).

---

## A. Kleine fixes & blokkers (eerst — laag risico, hoge winst)

### A1. Witte achtergrond bij de kopernaam → donker thema

- **Wat:** in de cockpit staat de achtergrond achter de koper-invoer/suggesties
  nog wit; moet donker (zwart) worden, passend bij de rest.
- **Waarom:** stoort tijdens het veilen; enige niet-getokeniseerde plek in de flow.
- **Huidige staat [Zeker]:** `src/components/BuyerAutocomplete.jsx` codeert drie
  kleuren hard op licht thema: `suggestionsStyle.background:'#fff'`,
  `inputStyle.border:'1px solid #ccc'`, `prioritySuggestionBtnStyle.background:'#f4f1ea'`.
- **Aanpak (hoe):** vervang de hardcodes door design-tokens uit `index.css`
  (`var(--card)` / `var(--surface)` voor achtergrond, `var(--border)` voor randen,
  `var(--text-primary)` voor tekst, een token-tint voor de ★-prioriteitsrij).
  Geen nieuwe tokens nodig.
- **Schema-impact:** geen.
- **Inschatting:** ~15 minuten, puur CSS in één component.

### A2. Markering "geen startprijs ingegeven" op de collectie-pagina

- **Wat:** op de gewone collectie-/lotlijst zichtbaar maken welke loten nog géén
  startprijs hebben, vóór je de cockpit ingaat.
- **Waarom:** zonder startprijs heeft de bod-tracker geen vertrekpunt en is de
  cockpit voor dat lot onbruikbaar — dat mag je niet pas mídden in de veiling
  ontdekken.
- **Huidige staat [Zeker]:** `CockpitPage` voedt `BidTracker` met
  `startPrice={lot.start_price}`. Is `start_price` leeg, dan ontbreekt het
  vertrekpunt. (Reserveprijs is hiervoor níét bepalend — het gaat om de
  **startprijs**.)
- **Aanpak (hoe):** twee lagen, robuust i.p.v. alleen cosmetisch.
  1. Per lot een duidelijke badge/indicator ("⚠ geen startprijs") in de lotlijst.
  2. Eén **pre-flight-telling** bovenaan de collectie-/dagweergave: "*3 loten
     zonder startprijs*", klikbaar zodat je er direct naartoe springt. Zo zie je
     het in één oogopslag vóór de veiling start.
- **Beslist (Frederik, 30 juni): enkel signaleren, niet blokkeren.** Je kan nog
  steeds hameren; de waarschuwing is informatief. Geen harde blokkade in de cockpit.
- **Schema-impact:** geen (`lots.start_price` bestaat al).
- **Inschatting:** halve dag.

---

## B. Spotters — samenhangende uitbouw (bouw in deze volgorde)

### B1. Spotterspool-pagina (met foto, filter per veilinghuis, selecteren naar veiling)

- **Wat:** een eigen pagina met de volledige pool aan spotters, mét foto. Vandaar
  kun je (a) filteren per veilinghuis en (b) geselecteerde spotters aan een
  veiling toevoegen.
- **Waarom:** de basis waarop B2 (per dag) en B3 (hotkey) verder bouwen. Nu worden
  spotters enkel onderaan de veiling-pagina toegevoegd via een dropdown.
- **Huidige staat [Zeker]:** globale tabel `spotters` heeft al `name`,
  `photo_url`, `notes`. Junction `collection_spotters` draagt `location` +
  `display_order` per collectie. Foto's komen nu via een **URL-veld**;
  upload naar Supabase Storage is nog niet gebouwd (staat als "Toekomstig").
- **Aanpak (hoe):**
  - Nieuwe route `/spotters` (globaal overzicht) met fotokaarten.
  - **Filter "per veilinghuis" — beslist (Frederik, 30 juni): automatisch
    afleiden uit historie.** Geen nieuwe tabel. Een spotter "hoort bij" een huis
    als hij in `collection_spotters` gekoppeld is aan een collectie van dat huis
    (`collection_spotters → collections → collections.house_id`). Het filter toont
    dus per huis de spotters die er al ooit aan toegewezen waren. Gevolg: een
    gloednieuwe spotter verschijnt pas onder een huis nadat hij één keer aan een
    veiling van dat huis is toegevoegd — dat is bewust en aanvaard.
  - Vanaf de pagina spotters aanvinken → in één keer aan een gekozen veiling
    toevoegen (schrijft `collection_spotters`-rijen).
  - Meteen **foto-upload via Supabase Storage** meenemen (vervangt het URL-veld),
    want een pool "met foto" zonder upload is half werk.
- **Schema-impact:** geen nieuwe tabel; enkel een Storage-bucket voor
  spotterfoto's (+ evt. een view/query die de huis-afleiding doet).
- **Inschatting:** 1–1,5 dag (pagina + afgeleid filter + upload).

### B2. Spotters per veilingdag bij meerdaagse veilingen

- **Wat:** bij een meerdaagse veiling per dag een andere spotter-samenstelling
  (dag 1: spotters 1–5; dag 2: vier daarvan + één nieuwe).
- **Waarom:** realistische bezetting verschilt per dag; nu is de spotter-set
  collectie-breed en dus identiek voor elke dag.
- **Huidige staat [Zeker]:** `collection_spotters` hangt aan `collection_id`,
  niet aan een dag. Veilingdagen bestaan (`collection_days`, 0031).
- **Aanpak (hoe):** voeg `collection_day_id` (nullable) toe aan
  `collection_spotters`. **`null` = geldt voor de hele collectie / alle dagen**
  (backward-compatible: bestaande rijen blijven werken). Is er een dag-specifieke
  rij, dan overschrijft die. UI: spotter-beheer krijgt een dag-kiezer; de cockpit
  laadt de spotters van de **actieve dag** (cockpit draait al per dag via
  `/cockpit/:id/:dayId`).
- **Schema-impact:** additieve, idempotente migratie (`add column … if not
  exists`) → mag automatisch toegepast worden.
- **Inschatting:** 1 dag (migratie + helpers in `spotters.js` dag-bewust + UI).
- **Afhankelijkheid:** logischer ná B1, maar kan ook los.

### B3. Spotter selecteren in de bod-tracker via hotkey

- **Wat:** tijdens het veilen een spotter aanduiden in de bod-tracker met een
  sneltoets.
- **Waarom:** sneller dan muis/tik tijdens het bieden.
- **Huidige staat [Zeker]:** `BidTracker` krijgt al de `spotters`-lijst als prop;
  er is nu geen sneltoets-koppeling.
- **Aanpak (hoe) — beslist (Frederik, 30 juni): beginletter van de naam, mét
  botsing-regel.**
  - Druk op een letter → selecteer de spotter in de bod-tracker wiens naam
    daarmee begint.
  - **Botsing-regel (verplicht, want twee namen kunnen dezelfde letter hebben):**
    deelt meer dan één spotter die beginletter, dan **cycelt** herhaald drukken
    op die letter door de spotters met dezelfde beginletter (M → eerste "M", M
    nogmaals → tweede "M", enz.). De actief geselecteerde spotter wordt duidelijk
    gemarkeerd in de strip, zodat een verkeerde keuze meteen zichtbaar is.
  - Hoofdletter-ongevoelig; reageert enkel als de bod-tracker actief is (niet
    tijdens typen in een tekstveld).
- **Schema-impact:** geen.
- **Inschatting:** halve dag (de cycle-bij-botsing maakt het iets meer dan een
  simpele key-listener).

---

## C. Klanten

### C1. Klant toegevoegd in de cockpit → permanent in het klantenbestand van die veiling

- **Wat:** voeg je tijdens het veilen in de cockpit een (koper)klant toe, dan
  moet die permanent in het klantenbestand van díe veiling belanden, niet enkel
  als losse koper op dat ene lot.
- **Waarom:** anders is de klant na de veiling "verdwenen" uit het overzicht van
  die veiling, terwijl hij er wel degelijk was.
- **Huidige staat [Waarschijnlijk]:** een nieuwe naam in het koper-veld maakt nu
  een huis-klant (`clients.house_id`) en zet `lots.buyer_client_id`. Wat
  ontbreekt is dat die persoon ook als **klant/geïnteresseerde van de collectie**
  wordt vastgelegd (de `client_auction_seating`/koppeling per veiling), zodat hij
  in het veiling-klantenbestand opduikt. (Te bevestigen bij de bouw door
  `BuyerAutocomplete` + `CockpitControls` te lezen.)
- **Aanpak (hoe):** bij het hameren met een nieuwe/gekozen koper ook een
  collectie-koppeling wegschrijven als die nog niet bestaat. **Met dedupe-check
  op naam** — anders vult je bestand zich met "Jan Peeters / J. Peeters / Jan
  peeters". Hergebruik de bestaande zoek/match-helpers in `src/lib/clients.js`.
- **Schema-impact:** vermoedelijk geen (tabellen bestaan); enkel extra schrijf +
  dedupe-logica.
- **Inschatting:** halve tot hele dag, vooral door de dedupe zorgvuldig te doen.

---

## D. Later & groot — Stream Deck via achtergrondscript

> **Status: geparkeerd. Geen prioriteit nu, wél de bedoeling om uiteindelijk uit
> te werken — met het achtergrondscript (Frederik, 30 juni).**

### D1. Wat Frederik wil

Een Stream Deck aan de computer met knoppen voor: spotter-bod omhoog / omlaag,
volgend lot, vorig lot, en een knop "terug naar de Veiling Pro-pagina". Kernvraag
van Frederik: *als ik op een andere website zit en ik druk "bod omhoog", wordt
dat dan tóch in de Veiling Pro-webapp doorgegeven?*

### D2. Het antwoord en waarom het een achtergrondscript vereist [Zeker]

Een Stream Deck stuurt standaard toetsaanslagen naar het venster dat vooraan
staat. Sta je op een andere website, dan gaat "bod omhoog" naar díe website —
**niet** naar Veiling Pro. Dat werkt dus alleen als de bod-actie via een **kanaal
op de achtergrond** loopt, los van welk venster vooraan staat.

Twee soorten knoppen, bewust uit elkaar gehouden:

- **"Terug naar Veiling Pro"** is puur lokaal: een Stream Deck-actie die de app/
  het tabblad naar voren haalt of de URL opent. Geen backend nodig.
- **bod omhoog / omlaag / volgend / vorig lot** moeten in de webapp registreren,
  óók als die niet vooraan staat → dít vereist het achtergrondkanaal.

### D3. Aanbevolen architectuur (hoe — Claude's keuze)

Hergebruik de stack die er al staat: **Supabase realtime**. Geen losse native
helper-app nodig.

1. Stream Deck-knop → een **HTTP-request** (via een Stream Deck "API request"-
   plugin) of een **klein lokaal Node-service** (zoals de bestaande scrape-worker
   op de mini) → schrijft een commando-rij in een nieuwe tabel `cockpit_commands`
   (bv. `{collection_id, day_id, action: 'bid_up'|'bid_down'|'next'|'prev'}`).
2. De cockpit **luistert** via Supabase realtime (die abonnementen draaien al in
   de app) en voert het commando uit — ongeacht welk venster vooraan staat.

Voordeel: één bewezen mechanisme, werkt cross-device, en de mini/laptop hoeft
geen toetsaanslagen te simuleren.

### D4. De architecturale horde die we eerst moeten nemen [Zeker]

De bod-tracker-stand zit nu in **lokale React-state** (`setTrackerState` in
`CockpitPage`), niet in de database. Een Stream Deck-knop kan alleen "bod omhoog"
laten registreren terwijl je wegkijkt als het **huidige bod een gedeelde bron
van waarheid** heeft (in de DB) waarop de cockpit zich abonneert. Dat is geen
detail maar de kern: zonder die stap kan de knop niets doen dat blijft hangen.
"Volgend/vorig lot" is makkelijker, want dat muteert `collections.active_lot_id`
— dat staat al in de DB.

**Gevolg voor de planning:** de Stream Deck-feature begint niet met de Stream
Deck, maar met het verplaatsen van de bod-tracker-stand naar de database +
realtime. Dat is meteen ook winst los van de Stream Deck (meerdere schermen
blijven in sync). Pas daarna de commando-tabel en de knoppen.

### D5. Inschatting

Meerdere dagen, in fasen: (1) bod-stand naar DB + realtime, (2) `cockpit_commands`
+ cockpit-listener, (3) Stream Deck-knoppen koppelen, (4) de lokale "terug naar
Veiling Pro"-knop. Fase 1 heeft op zichzelf al waarde en kan eerder.

---

## Voorgestelde volgorde in één blik

1. **A1** witte koper-achtergrond (15 min)
2. **A2** startprijs-markering + pre-flight (½ dag)
3. **B1** spotterspool-pagina + foto-upload + huisfilter (1–1,5 dag)
4. **B2** spotters per veilingdag (1 dag)
5. **B3** spotter-hotkey 1–9 in bod-tracker (½ dag)
6. **C1** koper-in-cockpit → permanent in veiling-klantenbestand + dedupe (½–1 dag)
7. **D** Stream Deck — later, begint met bod-stand naar DB

## Productkeuzes — beslist door Frederik op 30 juni 2026

1. **A2:** lege startprijs → **enkel signaleren**, niet blokkeren.
2. **B1:** spotter ↔ huis → **automatisch afleiden uit historie** (geen nieuwe tabel).
3. **B3:** spotter-hotkey → **beginletter van de naam**, met cycle-bij-botsing.

(Stream Deck blijft geparkeerd; alle andere punten worden nu opgepakt.)
