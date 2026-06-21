# Sessierapport — 21 juni 2026

## Deel 1: verkocht-voorinvulling, audit-correcties en inline pedigree-edit

**Resultaat:** gemerged in `main` (PR #12, commit `c4e8a6b`), live op productie
(https://veiling-pro.vercel.app). Migratie 0026 (`lot_sale_corrections`) staat
additief op productie (leeg). Deel 2 (sticky balk, cockpit-volgorde,
bod-tracker-bediening) komt op een verse branch van `main`.

Dit rapport legt de **beslissingen** vast (keuze · waarom · alternatief dat
afviel), niet het stap-voor-stap verloop.

---

## Beslissingen

### 1. Correcties krijgen een audit-spoor i.p.v. stille overschrijving
- **Keuze:** een aparte, append-only tabel `lot_sale_corrections`; de actuele
  waarde blijft in `lots` staan, elke wijziging logt één rij per veld (oud →
  nieuw + tijdstip).
- **Waarom:** Frederiks expliciete eis — geen verkoopbedrag dat stil verandert
  zonder spoor. De actuele waarde in `lots` houden zorgt dat alle bestaande
  queries/rapporten blijven werken.
- **Afgevallen:** rechtstreeks `lots` overschrijven (geen spoor); en een
  generieke history-tabel met triggers (zwaarder, niet nodig voor één operator).

### 2. "Wie corrigeerde" = alleen tijdstip, geen naam
- **Keuze:** enkel `corrected_at` vastleggen.
- **Waarom:** er is geen login (anon-key, één operator), dus een gebruikersnaam
  zou een leeg of verzonnen veld zijn.
- **Afgevallen:** een vrij "door wie"-tekstveld — bewust niet, om geen
  schijn-precisie te wekken.

### 3. Audit-rijen worden nooit gewist — alleen tegen-geboekt  *(→ CLAUDE.md)*
- **Keuze:** bij een echte foute correctie wordt de rij niet verwijderd maar
  **tegen-geboekt** met een nieuwe correctie. Vastgelegd als altijd-regel 8 in
  CLAUDE.md (stond daar nog niet).
- **Waarom:** de waarde van een audit-spoor verdwijnt zodra je het kan
  uitwissen.
- **Noot:** de 3 testrijen op lot 4 (NEW MAN DE COQUERIE) tijdens de
  terugdraai-test zijn wél verwijderd — dat was **zuivere testdata** op een echt
  veilinglot, expliciet zo benoemd en met akkoord. Dat is de enige uitzondering
  die de regel toelaat.

### 4. Niet-verkocht lot behoudt het hoogste bod, maar wist de koper  *(bewuste keuze)*
- **Keuze:** bij terugzetten naar "niet verkocht" blijft `sale_price` staan (als
  *hoogste bod*) tenzij de operator het bedrag-veld leegmaakt; `buyer` en
  `buyer_client_id` gaan **altijd** naar null.
- **Waarom:** voor een onverkocht lot is het hoogste bod nuttige info (zelfde
  conventie als de gewone hamer-flow), maar een koper slaat nergens op. Geen
  enkel van beide verdwijnt stil: prijs-wijziging én koper-wissing laten elk een
  correctie-rij na.
- **Afgevallen:** `sale_price` ook altijd op null zetten — dan zou je het
  hoogste bod verliezen.

### 5. Verkoopstatus én kanaal horen óók in het audit-spoor
- **Keuze:** de diff-detectie dekt vijf velden: `sold`, `sale_channel`,
  `sale_price`, `buyer`, `spotter_id`.
- **Waarom:** een statuswijziging (verkocht ⇄ niet verkocht) is juist de
  zwaarste correctie; die mag geen blinde vlek zijn. (Aanvankelijk ontbraken
  `sold`/`sale_channel` in de diff — toegevoegd.)

### 6. Pedigree-jsonb: read-modify-write, geserialiseerd per lot
- **Keuze:** elke pedigree-mutatie leest vlak vóór het schrijven de actuele
  `pedigree` opnieuw, past enkel de bewerkte knoop toe, en schrijft terug; per
  lot draaien deze writes via een wachtrij (niet parallel).
- **Waarom:** `pedigree` is één jsonb-kolom; zonder read-modify-write zou een
  tweede edit een oudere kopie terugschrijven en een andere tak overschrijven.
  De per-lot-queue voorkomt dat twee snelle saves elkaar overschrijven.
- **Afgevallen:** server-side `jsonb_set` per pad (bros bij deze data, want de
  stamboom mengt string- en object-knopen; vereist extra migratie).

### 7. Markeringen blijven hangen bij tekstcorrectie (remap)
- **Keuze:** markeringen zijn karakter-bereiken per voorouder-knoop; bij een
  tekstcorrectie worden ze omgerekend via een prefix/suffix-diff
  (`remapHighlights`). Markeringen leven **per knoop**, dus ze kunnen nooit naar
  een andere tak springen. Een volledig weggewist bereik verdwijnt.
- **Waarom:** Frederiks expliciete eis — markering moet aan het gecorrigeerde
  stuk blijven kleven.
- **Detail:** twee rakende selecties versmelten bewust tot één markering
  (genormaliseerd, geen gestapelde duplicaten).

### 8. Eén gebaar-model voor de voorouder-tekst, geen verborgen modus
- **Keuze:** **slepen** over tekst = markeren · **klik** op tekst (ook
  gemarkeerd) = corrigeren mét behoud · klik op de kleine **✕** = die markering
  wissen. Het ✕ is een visuele overlay, staat buiten `node.text` en telt niet
  mee in de karakter-offsets.
- **Waarom:** een aparte "markeer-modus"-knop was niet ontdekbaar; met
  slepen-vs-klikken bepaalt het gebaar zelf de actie en botst niets. Het ✕ apart
  houden zodat "corrigeren" een markering nooit per ongeluk wist (dat was juist
  de remap-eis).
- **Afgevallen:** markeer-modus-toggle + zwevende bevestig-popup (fragiele tweede
  klik, slechte ontdekbaarheid).

### 9. Verkocht-pop-up voorinvullen vanuit de bod-tracker
- **Keuze:** de pop-up opent met het laatste bod + spotter uit de tracker als
  **suggestie**, volledig overschrijfbaar. De tracker blijft efemeer (niets naar
  de DB); hij deelt zijn stand enkel via een callback naar boven.
- **Waarom:** sneller hameren zonder overtypen, zonder de bediening van de
  tracker te wijzigen (dat is deel 2).

### 10. Correctie bereikbaar op twee plekken
- **Keuze:** een gedeelde `SaleCorrectionModal`, te openen vanuit de **cockpit**
  (✎ op een afgehandeld lot) én het **eindoverzicht** (✎ per verkoopregel).
- **Waarom:** corrigeren gebeurt zowel tijdens als na de veiling.

---

## Bekende risico's / openstaand

- **Pedigree-edits hebben GEEN audit-spoor.** Anders dan de verkoopvelden worden
  inline correcties aan pedigree-namen, voorouder-teksten en markeringen
  **direct in de `pedigree`-jsonb** weggeschreven, zonder oud-waarde te bewaren.
  Bewust zo gelaten (catalogus-/voorbereidingsdata, geen geld), maar **expliciet
  als risico genoteerd**: een foute tekstcorrectie is niet terug te halen via
  een spoor. Indien later gewenst: zelfde aanpak als de verkoopcorrecties
  (append-only log) toepassen op pedigree.
- **`BidTracker.jsx` raakt deel 2.** Deel 2 (bod-tracker-bediening) zit in
  hetzelfde bestand dat deel 1 licht wijzigde (alleen een `onStateChange`-
  callback toegevoegd; de +/− bediening ongemoeid). Geen conflict zolang deel 2
  van de bijgewerkte `main` aftakt; dan bouwt het op deel 1's versie.

---

## Operationeel

- **Git op de Mac mini** staat nu op **SSH** (`git@github.com:…`) i.p.v. HTTPS:
  via SSH is er geen keychain nodig, dus de mini kan voortaan token-vrij pushen.
- **Migratie 0026** is additief en al toegepast op productie; code en DB staan
  los van elkaar (de merge raakt de DB niet).

## Verificatie (uitgevoerd)
- Verkocht-pop-up: tracker → prijs + spotter voor-ingevuld, overschrijfbaar.
- Correctie: terugdraai-test op een echt lot (status/kanaal/prijs in audit-rijen),
  daarna exact teruggezet; geen prijs verdween stil.
- Inline edit + markeringen: remap getest vóór/in/na de markering, ✕ wist,
  namen + beschrijving bewerkbaar — ook op de productie-build.
