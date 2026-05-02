# Audit — Vercel-deploy + cockpit-statusbalk + overzichtspagina

**Datum:** 2 mei 2026 (3 dagen voor deadline)
**Sessie:** Code (vanaf MacBook — repo gekloond, niet de gewone Mac Mini-werkomgeving)
**Type:** Infrastructure + twee features + UX-tweaks + utility

---

## Wat is er gewijzigd in deze sessie

### Infrastructure
1. **Vercel-account gekoppeld** aan GitHub-repo, project geïmporteerd, env-vars
   gezet (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
2. **`vercel.json`** toegevoegd in repo-root via GitHub web UI (commit `e45be77`)
   met SPA-fallback rewrites — zonder dit gaven deeplinks 404.
3. **Live op:** https://veiling-pro.vercel.app — auto-deploy bij elke push.

### Feature 1 — Cockpit-statusbalk (commit `24728d4`)
- Nieuw bestand `src/components/CockpitStatusBar.jsx`
- Toont read-only: X/N gehamerd · ✓ verkocht · ⊘ niet · omzet · ⌀ duur · einde ~HH:MM
- Drie states: empty (`0/24 · nog geen verkopen`), lopende veiling, finale (`✓ N/N · veiling klaar`)
- `CockpitPage.jsx`: lots-query uitgebreid met de relevante velden, en `onLotUpdated`
  callback werkt nu ook `allLots` lokaal bij zodat de balk meteen meedraait
  na elke hamer-actie (geen extra DB-call nodig).

### UX-tweak (commit `7c9798b`)
- **Statusbalk compacter**: kleinere padding, lijnhoogte en lettergrootte.
- **Duizendscheiding op ALLE bedrag-velden**:
  - `AutoSaveNumber.jsx` heeft nieuwe optionele prop `displayWithThousands`.
    Als true: input wordt text-input met `inputMode=numeric` en live formatting
    (15.000 ipv 15000). Niet-cijfers worden gestript bij invoer.
  - `LotPage`: aan op `start_price` + `reserve_price`.
  - `BidStepRulesEditor`: aan op `range_from`, `range_to`, `step`.
  - `CockpitPage` hamer-form prijsinput: inline geformatteerd met dezelfde logica.
- **`scripts/reset-auction.sql`** toegevoegd — utility om alle live-veilingdata
  van één veiling terug te zetten (alle hamer-tijdstempels + verkoop-velden +
  active_lot_id leeg). Vooraf gepoint op Aloga 2026; vóór 5 mei te runnen
  in Supabase SQL Editor.

### Feature 2 — Overzichtspagina einde veiling (commit `6f921c5`)
- Nieuw bestand `src/pages/AuctionSummaryPage.jsx`
- Nieuwe route `/auctions/:auctionId/summary` in App.jsx
- Drie blokken:
  - **Kerncijfers**: voortgang, verkocht/niet, totale omzet, gem. verkoopprijs,
    gem. duur per lot, totale wallclock-duur (van eerste in-de-piste tot
    laatste hamer)
  - **Per lot-type**: sport jumping vs sport dressuur — aantal, verkocht/niet,
    gemiddelde, totaal
  - **Per lot**: alle 24 met resultaat-regel (✓ zaal/online + €X · MM:SS) of
    "⊘ niet verkocht" of "nog niet gehamerd"
- Werkt ook tijdens lopende veiling — toont dan "(veiling nog bezig)" achter
  de titel
- **CockpitPage**: groene "📊 Overzicht einde veiling →"-knop verschijnt
  zodra `allLots.every(l => l.time_hammer != null)`

### Documenten
- PROJECT_STATUS.md: status-blok + open-punten herzien, Vercel/statusbalk/summary
  als afgerond, klanten-UI uitgewerkte spec toegevoegd (Frederik's wens
  van 02-05 over geïnteresseerden + tafelnummer + richting + opmerking
  + autocomplete + auto-overname binnen veiling)
- MASTER_PROMPT.md: alleen datum-update
- DEVELOPER_SETUP.md: datum + Vercel-sectie uitgebreid (live URL,
  vercel.json uitleg)

---

## Live URLs en wat te bookmarken

- **Productie / iPad-bookmark voor 5 mei:** https://veiling-pro.vercel.app
- **Cockpit Aloga (URL voor 5 mei):**
  https://veiling-pro.vercel.app/cockpit/bef304a5-29fc-47b3-af37-e808205ae60d
- **Overzicht-knop verschijnt automatisch op cockpit als alle 24 gehamerd zijn**

---

## Wat moet visueel gecontroleerd worden vóór 5 mei

- [ ] Cockpit op iPad in landscape — past de hele lay-out? Knoppen groot genoeg?
- [ ] Statusbalk leesbaar op iPad-afstand?
- [ ] Hamer-form: prijs invoeren met duizendscheiding voelt soepel?
- [ ] **Reset-data nog uitvoeren** — er staat nu 1 test-hamer in de DB.
      Run `scripts/reset-auction.sql` in Supabase SQL Editor vóór 5 mei.
- [ ] Eindtijd Aloga 2026 invullen (`auctions.time_auction_end`) — REST PATCH
- [ ] Overzichtspagina visueel checken met partial data (1+ hamerings)
- [ ] Test slechte WiFi (telefoon-hotspot) — blijft alles responsive?

---

## Wat zou fout kunnen gaan

- **Duizendscheiding bij snel typen / cursor-positie**: text-input met formatting
  zet de cursor altijd aan het eind na een formatting-pass. Bij invoegen-in-midden
  voelt dat onhandig. Frederik typt waarschijnlijk links-naar-rechts dus
  moet OK zijn — maar het is een bekende UX-trade-off.
- **Optimistic update na hamer**: lokale state-update is direct, maar als de
  DB-update faalt blijft de balk fout staan. Bij netwerkfout zien we een alert,
  geen rollback van de UI-state. Acceptabel risico bij goede WiFi op locatie.
- **Verwacht-einduur is wiebelig** bij <3 gehamerde lots door kleine sample —
  stabiliseert vanzelf na een paar hamerings.

---

## Hoe rollback indien nodig

Per commit:
- `e45be77` (vercel.json) — niet rollbacken, dan komen 404's terug
- `24728d4` (statusbalk) — `git revert 24728d4 && git push`
- `7c9798b` (UX-tweaks + reset-script) — `git revert 7c9798b && git push`
- `6f921c5` (summary-pagina) — `git revert 6f921c5 && git push`

Of via Vercel dashboard → Deployments → vorige Ready-deploy → "Promote to Production".

---

## Resterend werk vóór 5 mei

In volgorde van prioriteit:

1. **`scripts/reset-auction.sql` runnen** (1 minuut) — schoonmaak vóór de echte veiling
2. **Eindtijd Aloga 2026 invullen** (1 minuut REST PATCH of Supabase Table Editor)
3. **iPad-test** — cockpit doorlopen op tablet, ervaring valideren
4. *Eventueel* notities bewerkbaar in cockpit (cockpit stap 5) — comfort, niet kritisch

## Resterend werk na 5 mei

- Klanten-UI met geïnteresseerden + tafelnummer + richting + opmerking +
  autocomplete (uitgewerkte spec staat in PROJECT_STATUS.md)
- "Kopieer bid-step-staffel van vorige veiling"
- Range-overlap-validatie
- Drop deprecated columns (lots.bid_steps text, lots.lot_type text)

---

## Volgende code-sessie — opstartstappen

Op de Mac Mini (waar Frederik normaal werkt):

```bash
cd ~/veiling-pro
git pull              # haalt al het werk van deze MacBook-sessie op
npm install           # voor het geval er deps wijzigden
claude                # nieuwe Claude Code sessie
```

**Eerste prompt:**
> "Lees PROJECT_STATUS.md, MASTER_PROMPT.md, DEVELOPER_SETUP.md en
> reports/2026-05-02_cockpit-statusbar-summary-vercel.md voor context.
> Werkwijze geldt onverkort. Daarna: [concrete taak]."
