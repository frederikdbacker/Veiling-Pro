# Design-review en redesign-voorstel — Veiling-Pro

**Datum:** 2 mei 2026
**Status:** voorstel — eerst goedkeuring vragen, dan iteratief implementeren
**Scope:** alle zes pagina's + design-systeem

---

## 1. Vertrekpunt

Wat we hebben is een werkend product met een **utilitaire stijl**: zwart-op-wit-op-grijs, system-ui font, ad-hoc kleuren per plek. Het werkt, maar:

- Het voelt niet zoals een **professionele veilingmeester-tool** zou moeten voelen
- De cockpit (waar je op 5 mei staat) heeft geen visuele hiërarchie die helpt onder tijdsdruk
- Er is geen consistent kleurensysteem — `#5A8A5A` voor groen op de ene plek, `#222` voor zwart op de andere
- De typografie is eenvormig — geen onderscheid tussen "ik scan een titel" en "ik lees een paragraaf"

In MASTER_PROMPT staan al **design tokens** gedefinieerd (donkere achtergrond, gouden accent, Cormorant Garamond + DM Sans + Geist Mono) maar die zijn nog niet toegepast in de code. Dit voorstel implementeert die tokens en bouwt er een coherent systeem op.

---

## 2. Aftoetsing aan UI/UX-standaarden

| Standaard | Huidige stand | Probleem | Doel |
|---|---|---|---|
| **Visuele hiërarchie** | h1 / h2 / body verschillen alleen in fontgrootte | Op een drukke pagina (LotPage) loopt alles in elkaar | Onderscheid via font-family, weight, kleur en spacing |
| **Kleurcontrast** (WCAG AA) | `#666 op #fafafa` ≈ 5.7:1 ✅. `#bbb op #fff` ≈ 2.8:1 ❌ (placeholders, indicators) | Sommige hulp-tekstjes onleesbaar bij scherp licht | Minimaal 4.5:1 voor body, 3:1 voor large text |
| **Touch targets** (Apple ≥44pt) | Hamer-knoppen ~50pt ✅. ✕-knoppen ~24pt ❌. ✏-knoppen ~24pt ❌ | iPad-gebruik tijdens veilen: te klein | Alle interactieve elementen ≥44pt |
| **Whitespace en density** | Compacte lay-outs, weinig adempauze | Op iPad voelt het overladen | Royale verticale ruimte, vooral op cockpit |
| **Consistency** | Knoppen verschillen per pagina (`#222 zwart` vs `#5A8A5A groen`) | Geen herkenbaar patroon | Eén knoppen-systeem (primary/secondary/danger) |
| **Affordance** | Klikbare regels op `HousePage` zien er niet uit als knoppen | Onduidelijk wat klikbaar is | Hover-states, cursor-pointer, duidelijk randwerk |
| **Feedback** | Auto-save toont status. Cockpit-flow toont busy-states. ✅ | Goed | Behouden in nieuwe stijl |
| **Focus states** | Standaard browser-outlines | Inconsistent | Custom focus-rings in goud-accent |
| **Semantic HTML** | `<section>`, `<header>`, `<nav>` correct ✅ | Goed | Behouden |
| **Mobile-first** | Werkt op smartphone maar niet geoptimaliseerd | Cockpit is iPad-gericht; voorbereidings-flows worden op smartphone gebruikt | Breakpoints + flexibele lay-outs |
| **Cockpit-leesbaarheid op afstand** | `1.6em` titel, `1.05em` knoppen | Op iPad-arm-afstand (~70cm) marginaal | Cockpit krijgt eigen, grotere typeschaal |
| **Fitts' law** (kritische knoppen) | Hamer-knop is groot (✓) maar het hamer-bevestigformulier zit verstopt | Bij snelheid moet finale knop dichtbij focus | Hamer-bevestig-knop volle breedte, dichtbij prijs-input |

---

## 3. Design-systeem voorstel

### 3.1 Kleur

Donker thema, gebaseerd op MASTER_PROMPT-tokens, uitgebreid met semantische kleuren.

```
Achtergronden
  bg-base       #0E0C09   pagina-achtergrond
  bg-surface    #161310   secties / cards
  bg-elevated   #1D1A14   forms / dialogs
  bg-input      #221E16   input-velden

Tekst
  text-primary    #EDE4CF   body, paragrafen
  text-secondary  #B5A989   labels, hints
  text-muted      #6E6351   metadata, breadcrumbs

Accenten
  accent          #C8A96E   actieve states, links, primaire knop
  accent-hover    #D6BA82   hover op gouden elementen
  accent-muted    #8A7748   subtiel goud (focus-ring opacity)

Semantisch
  success         #5A8A5A   verkocht, gelukt, "✓ al gekocht"
  warning         #C8A02E   ontbrekende info, waarschuwing
  danger          #C24545   niet-verkocht (zacht rood ipv oranje)
  info            #6A8A9E   neutrale notificaties

Borders
  border-default  #2A2519   standaard rand
  border-strong   #3D3522   actieve cards, focus
```

### 3.2 Typografie

Drie webfonts, vanuit `<link>` in index.html (Google Fonts):

| Rol | Font | Gewicht | Gebruik |
|---|---|---|---|
| **Display** | Cormorant Garamond | 500 / 600 | h1, paardennaam in cockpit, veilingnamen |
| **Body** | DM Sans | 400 / 500 / 600 | algemene tekst, labels, knoppen |
| **Mono** | Geist Mono | 500 | cijfers (prijs, lotnummer, timer) |

Schaal (modulair, factor 1.25):

```
xs    0.75rem   12px   small print, save-indicator
sm    0.875rem  14px   metadata, breadcrumb
base  1rem      16px   body
md    1.125rem  18px   labels, knoppen
lg    1.5rem    24px   sectie-titels
xl    2rem      32px   pagina-titel
2xl   2.5rem    40px   cockpit paardennaam
```

Cockpit-typeschaal apart (alles +25%):

```
cockpit-base   1.25rem   20px   tekst tijdens veilen
cockpit-md     1.5rem    24px   knop-labels
cockpit-lg     2rem      32px   timer, prijs
cockpit-xl     3rem      48px   actieve paardennaam
```

### 3.3 Spacing en radius

```
Spacing (rem)
  1  0.25
  2  0.5
  3  0.75
  4  1
  5  1.5
  6  2
  8  3
  12 6

Radius
  sm    4px    inputs, kleine knoppen
  md    6px    cards, blocks
  lg    10px   primary panels
  full  9999px pillen, badges
```

### 3.4 Componenten-bibliotheek

Vier kern-componenten die overal hergebruikt worden:

- **Button** — varianten: `primary` (goud), `secondary` (transparent met rand), `danger` (rood subtiel), `ghost` (alleen tekst)
- **Card** — `bg-surface` met `border-default`, padding-md, radius-md
- **Input** — `bg-input` achtergrond, gouden focus-ring, label boven
- **Badge** — kleine pillen voor status (verkocht / niet / actief)

### 3.5 Implementatie-aanpak

CSS-custom-properties (variabelen) in `index.css`:

```css
:root {
  --bg-base: #0E0C09;
  --accent: #C8A96E;
  /* ... */
}
```

Dan inline-styles in components verwijzen naar `var(--accent)` enz. Geen Tailwind, geen CSS-in-JS-library — bewust low-tech zodat het Vite-buildproces simpel blijft.

---

## 4. Pagina-voor-pagina: huidige stand → voorstel

### 4.1 HousesPage (`/`)

**Huidige stand:**

```
┌─────────────────────────────────────┐
│ Veiling Pro                         │  ← header met logo
│ ─────────────────────────────────── │
│                                     │
│ Veilinghuizen                       │  ← h1, weinig presence
│ 1 veilinghuizen gevonden            │  ← grijze status-tekst
│                                     │
│ • [Aloga] — België                  │  ← bullet list, klein
│                                     │
└─────────────────────────────────────┘
```

**UX-pijnpunten:**
- Bullet-list voelt amateuristisch voor een professionele tool
- Geen visuele uitnodiging om door te klikken
- Status-string "1 veilinghuizen gevonden" is technisch
- Geen onderscheid tussen "actieve veiling staat eraan te komen" vs gewoon archief

**Voorstel:**

```
┌──────────────────────────────────────────────┐
│  V E I L I N G   P R O                       │  ← Cormorant, gouden tint
│ ──────────────────────────────────────────── │
│                                              │
│  Veilinghuizen                               │  ← display-xl
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  ALOGA                          🔜    │   │  ← card, hover-effect
│  │  België · 1 veiling actief    →       │   │  ← muted metadata
│  │                                       │   │
│  │  Aloga Auction 2026 — 5 mei (3 dagen)│   │  ← komt binnenkort, met
│  │                                       │   │     countdown-badge
│  └──────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

- **Card** in `bg-surface` met `border-default`, hover → `border-strong + accent-glow`
- **Countdown-badge** (🔜) als de eerstvolgende veiling binnen 14 dagen valt
- Eronder de naam van de eerstvolgende veiling als preview, met dagen-tot-veiling
- Geen status-string meer, of subtiel onderaan ("1 huis · 1 veiling")

### 4.2 HousePage (`/houses/:id`)

**Huidige stand:**

```
┌─────────────────────────────────────┐
│ ← Veilinghuizen                     │
│                                     │
│ Aloga                               │  ← naam zonder context
│ 1 veilingen                         │
│                                     │
│ Aloga Auction 2026                  │  ← klikbare regel
│ 5 mei 2026 — Wijngaardlaan          │
│ ─────────────────────────────────── │
│                                     │
└─────────────────────────────────────┘
```

**UX-pijnpunten:**
- Geen huisinformatie zichtbaar (land, contact, website)
- Veiling-regel ziet er niet uit als knop / kaart
- Geen onderscheid actieve / archief-veilingen

**Voorstel:**

```
┌──────────────────────────────────────────────┐
│  ← Veilinghuizen                             │
│                                              │
│  ALOGA                                       │  ← display-2xl
│  België · aloga.be                           │  ← muted contactlijn
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ KOMT ERAAN                           │   │  ← badge: "actief"
│  │                                       │   │
│  │ Aloga Auction 2026                   │   │  ← display-lg
│  │ Dinsdag 5 mei · 20:00 → ~22:48       │   │  ← gemonospaceerde tijd
│  │ Wijngaardlaan, [plaats]               │   │
│  │                                       │   │
│  │ 24 lots · 19 spring · 5 dressuur     │   │
│  │                                       │   │
│  │ [→ Voorbereiding]   [→ Cockpit]      │   │  ← directe entry-knoppen
│  └──────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

- Voor eerstvolgende veiling: **prominente card met directe shortcuts** naar voorbereiding én cockpit
- Voor archief-veilingen: kleinere kaarten in lijst eronder
- Lot-aantal + splitsing per discipline = quick stat

### 4.3 AuctionPage (`/auctions/:id`)

**Huidige stand:**

```
┌──────────────────────────────────────────────┐
│ Veilinghuizen › Aloga                        │
│                                              │
│ Aloga Auction 2026                           │
│ 24 lots · [🎬 Cockpit openen]                 │
│                                              │
│ Lot-types in deze veiling                    │  ← LotTypesSelector
│ [✓ jumping] [✓ dressage] [   eventing]       │
│                                              │
│ Biedstappen                                   │  ← BidStepRulesEditor
│   sport jumping                              │
│     Van €0 tot €5.000 stap €100   [🗑]        │
│     Van €5.000 tot ∞ stap €500    [🗑]        │
│   [+ Regel toevoegen]                         │
│                                              │
│ Lot lijst                                     │
│ ─────────────────────────                    │
│ [📷] #1 Donatella Z                           │
│      springen • 2018 • merrie • BWP          │
│      Casall × Cornet's Diamond                │
│ ─────────────────────────                    │
│ ...                                           │
└──────────────────────────────────────────────┘
```

**UX-pijnpunten:**
- Drie zones (lot-types / biedstappen / lots-lijst) hebben gelijke visuele zwaarte — ratio klopt niet, lots zijn de hoofdmoot
- Lot-types-selector overstijgend, biedstap-editor lang, lot-lijst eronder verschuift onder de fold
- Lots-lijst is dichte stripping, geen prijs-info, geen status (gehamerd? in piste?)

**Voorstel:** twee-koloms layout met **"setup links, lots rechts"** OF **collapsable secties** voor types/biedstappen:

```
┌──────────────────────────────────────────────────────────┐
│ ALOGA › Aloga Auction 2026                               │
│                                                          │
│ Aloga Auction 2026          [→ Cockpit]  [→ Overzicht]   │
│ 5 mei · 20:00 · Wijngaardlaan                            │
│                                                          │
│ ▼ LOT-TYPES & BIEDSTAPPEN  (uitklap, default ingeklapt)  │
│   sport jumping  [edit]                                  │
│   sport dressage [edit]                                  │
│                                                          │
│ ──────────────────────────────────────────────────────── │
│                                                          │
│ 24 LOTS                                          [zoek 🔍]│
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ [📷]  #1   Donatella Z                          │    │
│  │       2018 merrie · BWP · sport jumping         │    │
│  │       Casall × Cornet's Diamond                 │    │
│  │       Start €5.000 · Reserve €15.000            │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ [📷]  #2   Eldorado                       ⚠ 3   │    │
│  │       ...                                       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Lot-types & biedstappen ingeklapt** by default (admin-task, niet bezig tijdens voorbereiding)
- **Cockpit + Overzicht knoppen rechtsboven** naast de titel
- **Lot-cards** met meer info: prijzen, ontbrekende-info-badge, klikbare hele card

### 4.4 AuctionSummaryPage (`/auctions/:id/summary`)

**Huidige stand:**

Deze pagina is bedoeld om aan organisatie/klanten te tonen na de veiling. De huidige implementatie heeft drie blokken (kerncijfers, per type, per lot) maar geen visuele wow-factor.

**Voorstel — "showpiece"-vibe:**

```
┌────────────────────────────────────────────────────┐
│                                                    │
│        A L O G A   A U C T I O N   2 0 2 6        │  ← display-2xl Cormorant
│           5 mei 2026 · Wijngaardlaan              │
│                                                    │
│  ┌──────────────────────────────────────────┐     │
│  │                                          │     │
│  │       € 1 . 2 4 7 . 5 0 0                │     │  ← grote omzet
│  │       Geveild op deze avond              │     │
│  │                                          │     │
│  │   24/24 gehamerd  ✓ 22 verkocht          │     │
│  │   ⌀ 02:42 per lot  ·  duur 1u 04m        │     │
│  │                                          │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  PER DISCIPLINE                                    │
│  ┌──────────────────────────────────────────┐     │
│  │ SPORT JUMPING                            │     │
│  │   17 verkocht · 2 niet · ⌀ €58.500       │     │
│  │   Totaal €994.500                        │     │
│  └──────────────────────────────────────────┘     │
│  ...                                               │
│                                                    │
│  ALLE LOTS                                         │
│  #1  Donatella Z         ✓ zaal   €45.000  02:18  │
│  #2  Eldorado            ✓ online €72.000  03:24  │
│  #3  Forrest             ⊘ niet verkocht          │
│  ...                                               │
└────────────────────────────────────────────────────┘
```

- **Hero-blok met de totale omzet** in groot, gouden Geist Mono
- Kerncijfers eronder iets kleiner
- "Alle lots" als compacte tabel, monospace voor cijfers

### 4.5 LotPage (`/lots/:id`)

Dichtste pagina van het hele systeem — er staat veel op (foto, paardgegevens, catalog, EquiRatings, video, voorbereiding-velden, klanten-sectie, notities, prev/next nav).

**UX-pijnpunten:**
- Alles staat onder elkaar in één lange scroll → "wat is belangrijk?"
- Foto-gallery geclaimed door catalog-tekst eronder
- Voorbereiding-velden + klanten + notities zijn aparte secties die op dezelfde manier eruitzien

**Voorstel — twee koloms op desktop, één kolom op mobile:**

```
┌──────────────────────────────────────────────────────────┐
│ Aloga › 2026 › Lots                                      │
│                                                          │
│ ⚠ Ontbreekt: lot-nummer, video                           │  ← geel banner
│                                                          │
│ #1  DONATELLA Z                                          │  ← Cormorant 2xl
│     2018 merrie · BWP · 162cm · sport jumping            │
│     Casall × Cornet's Diamond                            │
│                                                          │
│ ┌──────────────────────┬─────────────────────────┐     │
│ │ [grote foto]         │ Voorbereiding           │     │
│ │                      │  Lot-nummer  [1]        │     │
│ │ [thumb thumb thumb]  │  Startprijs  [€ 5.000]  │     │
│ │                      │  Reserve     [€15.000]  │     │
│ │                      │                         │     │
│ │                      │ Externe links           │     │
│ │                      │  Hippomundo  [URL]      │     │
│ │                      │  Horsetelex  [URL]      │     │
│ │                      │                         │     │
│ │                      │ Notities                │     │
│ │                      │  Catalogus  [_______]   │     │
│ │                      │  Video      [_______]   │     │
│ │                      │  Organisatie[_______]   │     │
│ └──────────────────────┴─────────────────────────┘     │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ CATALOGUSTEKST                                     │  │
│ │ 5-jarige merrie van het hoogste niveau...          │  │
│ └────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────┐  │
│ │ EQUIRATINGS                                        │  │
│ │ International score: 8.4...                        │  │
│ └────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────┐  │
│ │ VIDEO  [embed]                                     │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ GEÏNTERESSEERDE KLANTEN                            │  │
│ │ • Janssens     tafel 12 · links voor       [✏][✕] │  │
│ │   "vorig jaar gekocht"                            │  │
│ │   ✓ al gekocht: #5 Donatella Z                    │  │
│ │ • De Bock      tafel 4 · rechts midden     [✏][✕] │  │
│ │ [+ Klant toevoegen]                               │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ← #0 Begin                            #2 Eldorado →      │
└──────────────────────────────────────────────────────────┘
```

- **Twee koloms boven de fold**: foto-gallery links (groot, primaire content), voorbereidings-velden rechts (compact, scanbaar)
- **Tekstuele blokken** (catalog/EquiRatings/video) eronder als kaarten
- **Klanten-sectie** als laatste interactieve blok
- Op mobile: alles onder elkaar (huidige stack)

### 4.6 CockpitPage (`/cockpit/:id`)

**Belangrijkste pagina** — wat je op 5 mei voor je hebt op iPad.

**Huidige stand:** alles staat in één kolom: header, statusbalk, lot-picker, dan een groot ActiveLotPanel met foto links, info rechts, knoppen, hamer-form, klanten, biedstappen, notities. Lange scroll.

**UX-pijnpunten:**
- Typografie te klein voor iPad-arm-afstand
- Drie-knop-flow (IN DE PISTE / START / HAMER) is goed maar mag visueel sterker zijn
- Statusbalk is klein en monochroom
- Hamer-form staat ver onder de fold — bij snel-veiligen scrollen onhandig
- Geïnteresseerden + klanten + biedstappen + notities + links allemaal door elkaar

**Voorstel — "veilingmeester-cockpit" als geconcentreerd dashboard:**

```
┌──────────────────────────────────────────────────────────────────┐
│ Aloga › Aloga Auction 2026 › Cockpit                             │
│                                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   3/24 · ✓ 2 verkocht · omzet €47.500 · ⌀ 02:48 · einde ~21:38  │  ← Geist Mono
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                  │
│   Lot 4 ▼                                                       │  ← lot-picker
│                                                                  │
│   ┌──────────────┐   #4 ELDORADO                                │
│   │   [foto]     │   2019 hengst · BWP · sport jumping          │  ← Cormorant 2xl
│   │              │   Quasimodo Z × Cassini I                    │
│   │              │   Start €4.000  ·  Reserve €12.000           │
│   └──────────────┘                                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  GEÏNTERESSEERDEN                                          │ │
│  │  ★ Janssens   tafel 12 · links voor                        │ │
│  │    ✓ al gekocht: #1 Donatella Z                            │ │
│  │  ★ De Bock    tafel 4 · rechts midden                      │ │
│  │     "houdt van 5-jarigen"                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ⏱ 02:18 in de piste     ⏱ 01:42 bieden actief             │ │  ← Geist Mono lg
│  │                                                            │ │
│  │  [   ✓ IN DE PISTE   ][ START BIEDEN ][   HAMER   ]        │ │  ← grote knoppen
│  │                                                            │ │
│  │  Volgend lot → #5 Forrest                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CATALOGUSTEKST                                            │ │
│  │  5-jarige hengst van het hoogste niveau, ...               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Mijn voorbereiding ──┐   ┌─ Biedstaffel ──┐                 │
│  │  Catalogus  [_______] │   │ €0 - €5.000:€100│                 │
│  │  Video      [_______] │   │ €5k - ∞:    €500│                 │
│  │  Organisatie[_______] │   └─────────────────┘                 │
│  └───────────────────────┘                                       │
│                                                                  │
│  Externe links: 🔗 Hippomundo  🔗 Horsetelex                     │
└──────────────────────────────────────────────────────────────────┘
```

- **Statusbalk** wordt monospace gold, dikker, op donkere achtergrond
- **Paardennaam** in display-3xl Cormorant (goud)
- **Knoppen**: grote vol-breedte, hoge contrast, met state-kleuren (groen done, goud actief, gedimd pending)
- **Geïnteresseerden direct onder paardgegevens** (cruciale info tijdens veilen) — niet onder catalog/EquiRatings
- **Twee-koloms onderaan**: "mijn voorbereiding" links (grote textareas), "biedstaffel" rechts (compacte tabel)
- Externe links als kleine pillen onderaan (referentie, geen primaire actie)

**Hamer-form-redesign**: openen als modal/overlay met grote vol-breedte knoppen i.p.v. ingeklapt onderaan:

```
┌────────────────────────────────────────────┐
│  HAMER #4 ELDORADO                    ✕    │
│  ──────────────────────────────────────    │
│                                            │
│  ( ) Verkocht in zaal                      │
│  ( ) Verkocht online                       │
│  (•) Niet verkocht                         │
│                                            │
│  Verkoopprijs:                             │
│  ┌──────────────────────────────────────┐ │
│  │ €  15.000                            │ │  ← grote prijs-input
│  └──────────────────────────────────────┘ │
│                                            │
│  Koper:                                    │
│  ┌──────────────────────────────────────┐ │
│  │ ★ Janssens                           │ │  ← suggestie open
│  │   De Bock                            │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌─────────────┐  ┌────────────────────┐ │
│  │  Annuleer   │  │  ✓  HAMER          │ │  ← grote bevestig-knop
│  └─────────────┘  └────────────────────┘ │
└────────────────────────────────────────────┘
```

---

## 5. Implementatie-plan

Voorstel: **gefaseerd uitrollen** in deelcommits zodat je tussendoor kan beoordelen.

### Fase A — Design-systeem fundament (1 commit)
- `src/index.css`: CSS-variabelen voor alle tokens
- `<link>` naar Google Fonts in `index.html` (Cormorant Garamond, DM Sans, Geist Mono)
- Body `background-color` en `color` op donker thema
- App.jsx wrapper aangepast (max-width, padding-tokens)
- Géén individuele pagina aangeraakt — alleen het basisscherm wordt al donker
- **Visual check**: bij elke pagina is achtergrond donker, tekst leesbaar, fonts geladen

### Fase B — CockpitPage redesign (1 commit)
Eerst de belangrijkste pagina — Frederik werkt hier op 5 mei.
- Statusbalk: monospace goud op donker
- Paardennaam display-3xl Cormorant
- Drie-knop-flow grotere knoppen
- Hamer-form als modal-overlay
- Geïnteresseerden direct onder paardgegevens
- Twee-koloms onderaan
- **Visual check**: open `/cockpit/<aloga-id>`, doorloop een lot

### Fase C — LotPage redesign (1 commit)
- Twee-koloms layout boven de fold
- Cards voor catalog/EquiRatings/video
- Grote paardennaam
- Bewerk-knop op klanten-rij krijgt design uit kit

### Fase D — AuctionPage + AuctionSummaryPage (1 commit)
- AuctionPage: collapsable types/biedstappen, lot-cards met prijs
- SummaryPage: hero met grote omzet
- **Visual check**: open beide

### Fase E — HousesPage + HousePage (1 commit)
- Cards met countdown-badges
- Directe shortcuts op huis-pagina

### Fase F — Component-refresh (1 commit)
- AutoSaveNumber, AutoSaveUrl, NoteField, BidStepRulesEditor in nieuwe styling
- Buttons gestandaardiseerd
- Inputs met goud-focus-ring
- **Visual check**: alle pagina's nogmaals door

### Schatting

| Fase | Tijd | Risico |
|---|---|---|
| A | 30 min | Laag — puur additief |
| B | 60-90 min | Middel — cockpit is gevoelig, veel state |
| C | 60 min | Laag — vooral CSS-werk |
| D | 60 min | Laag |
| E | 30 min | Laag |
| F | 60 min | Middel — raakt veel components |

Totaal: 4-6 uur, gespreid over meerdere mini-sessies. Tussendoor jij visueel testen.

---

## 6. Open vragen

Voor je goedkeurt — drie keuzes waar ik graag jouw mening bij weet:

1. **Donker thema overal, of cockpit donker en voorbereidings-pagina's licht?**
   Voorstel: overal donker, voor coherentie. Voorbereiding wint ook bij donker thema (oogen-comfort tijdens lange editing-sessies).

2. **Hamer-form als modal of inline?**
   Voorstel: modal-overlay. Voordeel: vol-scherm-focus, grote knoppen, geen layout-shift. Nadeel: andere paddings dan de rest.

3. **Cards rond catalog/EquiRatings/video, of doorlopende secties?**
   Voorstel: cards met `bg-surface`, geeft duidelijke visuele afbakening en past bij de rest.

---

## 7. Wat ik **niet** voorstel (uit scope-disclaimer)

- Animaties / transitions (alleen subtiele hovers)
- Custom illustraties of iconen-set (gebruiken emoji + unicode-symbols zoals nu)
- Light/dark-mode toggle (alleen donker)
- Volledige toegankelijkheid-audit (focus, ARIA, keyboard) — basis zit erin, diepe audit na 5 mei
- Tailwind / styled-components / CSS-modules introductie — blijven bij inline styles + CSS-variabelen
