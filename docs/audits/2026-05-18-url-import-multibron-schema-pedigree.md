# Audit — 18 mei 2026

**Thema:** Collectie-import via URL (multi-bron) + collections-schema-alignment
+ 3-generatie afstamming + veiling verwijderen + werkwijze vastgelegd.

Geschreven in gewone taal voor Frederik. Doel: wat is gewijzigd, wat kan
misgaan, wat moet je visueel controleren, hoe terugrollen.

---

## Wat is er gewijzigd

### 1. Veiling toevoegen via een link (nieuw)
- Nieuwe pagina **"Collecties"** (link rechtsboven "+ Collectie via URL").
  Je plakt een link van een veilingsite, klikt "Collectie ophalen", en het
  systeem haalt alle paarden binnen (naam, afstamming, geslacht, foto's,
  catalogustekst, video).
- Er is een knop **"⚡ Verden YoungSTARS 2026 voorinvullen"** voor die
  specifieke veiling.
- Op een veilingpagina staat **"↻ Collectie verversen via URL"**.

### 2. Vier veilingsites ondersteund
Het systeem herkent automatisch van welke site de link komt en gebruikt het
juiste ophaal-script:
- **HORSE24** (o.a. verdener-auktion-online.com) — afstamming 3+ generaties.
- **Zangersheide** — afstamming 3+ generaties.
- **WeAuction / Aloga** — afstamming 1 generatie (zo toont die site het).
- **PWB** (horseauctionbelgium.com én paardenveilingonline.com) — 1 generatie.

### 3. Verden-veiling gevuld
- "Verden Auction YoungSTARS OnLive" (30 mei 2026) had al een lege vermelding
  in de database. Die is nu gevuld met **84 paarden**, inclusief de
  afstamming over 3 generaties.
- Per ongeluk eerst een dubbele vermelding aangemaakt → opgeruimd; de 84
  paarden staan in de juiste, al bestaande vermelding.

### 4. Afstamming over 3 generaties zichtbaar
- Nieuw afstammingsschema (ouders → grootouders → overgrootouders) op de
  paardpagina én in de cockpit.

### 5. Database-koppeling rechtgezet
- De live-database gebruikt andere namen dan de oude code verwachtte
  (`collections` i.p.v. `auctions`). Alle pagina's zijn daarop afgestemd,
  anders gaven ze een foutmelding.

### 6. Veiling verwijderen
- Op de huis-pagina staat per veiling een **🗑 Verwijder**-knop, met
  bevestiging die toont hoeveel paarden mee verwijderd worden.

### 7. Werkwijze vastgelegd
- Nieuw bestand **`CLAUDE.md`** (op `main`): hoe er in dit project gewerkt
  wordt — één stap per keer, plan vóór nieuwe functie, audit-rapporten,
  controle vóór elke opslag, géén snelle fix maar de meest solide oplossing.

---

## Wat kan er misgaan / aandachtspunten

- **Herstart nodig:** de "Collectie via URL"-knop werkt pas na een herstart
  van de lokale ontwikkelomgeving (`npm run dev` opnieuw starten), omdat er
  een instellingenbestand is gewijzigd.
- **Zangersheide-foto's:** die site laadt foto's apart in; bij Zangersheide
  blijven foto's mogelijk leeg. Naam/afstamming/geslacht komen wél binnen.
- **WeAuction/PWB-afstamming is 1 generatie** — geen fout, die sites tonen
  niet meer dan vader × moedervader.
- **Charity/embryo-loten** (bv. een Wagyu-koe als goede doel) hebben rare
  velden — randgeval, geen bug.
- **Git-stand:** de grote nieuwe functies staan op een aparte tak
  (`feat/collectie-url-import-multibron`) met een Pull Request (#1) op
  GitHub. `main` is enkel aangevuld met `CLAUDE.md` en dit audit-rapport.
  De live database is wél al bijgewerkt (Verden 84 paarden).

## Wat jij visueel moet controleren

1. Herstart de ontwikkelomgeving, open de app.
2. Ga naar **Verden Auction YoungSTARS OnLive** → zie je 84 paarden?
3. Open een paard (bv. lot 1 "Derrix") → zie je het **afstammingsschema
   over 3 generaties**?
4. Open de **cockpit** van Verden → werkt die zonder foutmelding en toon
   hij ook de afstamming?
5. Test de **"+ Collectie via URL"**-pagina met de Verden-preset (hoeft niet
   nog eens te importeren — het mag al-aanwezig melden).

## Hoe terugrollen indien nodig

- **App-code:** `main` is ongewijzigd op functioneel vlak; de nieuwe functies
  zitten in PR #1. Niet mergen = niets verandert aan de app.
- **`CLAUDE.md` / dit rapport:** `git revert 6e804f7` (of de betrokken
  commit) op `main`.
- **Database (Verden 84 paarden):** kan via Supabase verwijderd worden met
  de verwijderknop op de huis-pagina, of handmatig in Supabase. (Aanrader:
  Supabase-export maken vóór grote database-acties — werkwijze-principe 8.)

---

## Git-overzicht

- Tak `feat/collectie-url-import-multibron`: 3 commits (scraper+registry;
  import+UI; schema-alignment+afstamming+verwijderknop). Gepusht. **PR #1**
  open tegen `main`.
- `main`: commit `6e804f7` (CLAUDE.md) + dit audit-rapport.
