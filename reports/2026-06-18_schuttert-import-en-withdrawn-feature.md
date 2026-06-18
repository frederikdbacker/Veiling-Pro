# Sessierapport — 18 juni 2026

**Onderwerpen:** Schuttert Sport Sales import (3 collecties) + HorseTelex-pedigrees + nieuwe "niet-deelnemend lot"-functie.

## In gewone taal — wat is er gebeurd?

### 1. Veilinghuis Schuttert Sport Sales toegevoegd

Een nieuw Nederlands veilinghuis (Stegeren, Ommen-Noord) met drie collecties tegelijk binnengehaald:

- **2026** (aankomend) — 15 lots
- **2025** (afgelopen) — 13 lots, mét verkoopprijzen
- **2024** (afgelopen) — 14 lots, mét verkoopprijzen

In totaal **42 paarden** met foto's, ouderlijn, geboortejaar, geslacht, studbook, catalogtekst, YouTube-video en HorseTelex-link. Voor de afgelopen veilingen werd de hamerprijs automatisch uit de titel ("SOLD FOR €44.000,-") gehaald. Datum/locatie van de 2026-veiling staan nog leeg (zal je later via de UI invullen).

Het huis kreeg het officiële logo en twee comitéleden: **Hendrik Jan + Sally Schuttert** als eigenaren.

### 2. Volledige pedigrees voor alle 15 lots van 2026

HorseTelex zit achter een betaalmuur, maar je hebt manueel screenshots aangeleverd van alle 15 pedigree-pagina's. Daaruit heb ik per paard **3 generaties afstamming** overgenomen (vader/moeder + 4 grootouders + 8 overgrootouders) — exact in hetzelfde formaat als de Aloga-pedigrees, dus de bracket-tree in de cockpit en op de lotpagina toont alles correct.

⚠️ Aandachtspunt: ik typte de ~210 paardennamen handmatig over. Check steekproefsgewijs of er geen typo's in zitten (vooral diakritische tekens en apostrofes).

### 3. Nieuwe functie: "Lot trekt zich terug uit veiling"

Als een paard last-minute uitvalt (blessure, terugtrekking door verkoper), kun je het nu markeren als **niet-deelnemend** zonder het te wissen. Alle voorbereiding (klanten, notities, foto's, pedigree) blijft bewaard.

**Waar zit de knop?**
- **Op een lotpagina** — onderaan het "Lot & prijzen"-blok: knop "🚫 Markeer als niet-deelnemend". Eens aangeklikt verschijnt er bovenaan een rode banner met "↩ Laat alsnog deelnemen" om de actie ongedaan te maken.
- **In de cockpit** — naast de grote VERKOCHT-knop staat nu een tweede knop "🚫 Niet deelnemend". De VERKOCHT-knop wordt automatisch uitgeschakeld voor zo'n lot.

**Gedrag tijdens de veiling:**
- Vorig/Volgend slaat withdrawn lots **automatisch over** (sneller doorklikken).
- De voortgangsteller toont "12/14 gehamerd" i.p.v. "12/15" als er 1 paard is uitgevallen — anders bereik je nooit 100%.
- Een extra teller "🚫 1 niet-deeln." verschijnt apart in de statusbalk.
- In de lot-dropdown krijgt het lot een 🚫-vlag.

**Op andere pagina's:**
- In de lotlijst van een collectie: rode badge "NIET DEELN.", door-streep door de naam, lichte vervaging.
- Op de overzichtspagina einde veiling: aparte sectie "Niet-deelnemend (N)" onderaan; deze lots **tellen niet mee** in omzet/gemiddelden.

## Wat is er in de database veranderd?

Eén nieuwe migratie:

```
0027_lots_withdrawn.sql
   alter table lots add column withdrawn boolean not null default false;
```

Bestaande lots krijgen automatisch `withdrawn = false`. Geen back-up nodig (puur additief, default-waarde, niet-destructief).

## Wat staat er live op productie?

- 3 nieuwe collecties + 42 lots + huis + comité + logo
- Alle 15 pedigrees van Schuttert 2026
- "Niet-deelnemend"-functie volledig draaiend in alle pagina's

Vercel heeft 3 deploys auto-uitgevoerd na de pushes (commits `f92571d`, `39f5385`, `06b732d`).

## Open punten

- Datum/locatie van Schuttert Sport Sales 2026 nog manueel invullen via de UI.
- Pedigrees visueel checken op typo's (~210 namen, manueel overgetypt).
- HorseTelex-toegang blijft een open vraag voor toekomstige veilingen: voor 2027 e.v. zit je opnieuw met dit probleem tenzij je een (proef-)abonnement neemt.

## Bestanden gewijzigd / toegevoegd

**Nieuw:**
- `scripts/scrape-schuttert.mjs` — generieke scraper per jaar
- `scripts/import-schuttert-extras.mjs` — huis-logo + comitéleden
- `scripts/import-schuttert-pedigree.mjs` — pedigree-loader
- `data/schuttert-2024.json`, `schuttert-2025.json`, `schuttert-2026.json`
- `data/schuttert-2026-pedigree.json`
- `supabase/migrations/0027_lots_withdrawn.sql`

**Gewijzigd (withdrawn-feature):**
- `src/pages/LotPage.jsx`
- `src/pages/CockpitPage.jsx`
- `src/pages/CollectionPage.jsx`
- `src/pages/CollectionSummaryPage.jsx`
- `src/components/CockpitStatusBar.jsx`
- `src/components/LiveInfoBar.jsx`
