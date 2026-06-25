# Audit-rapport — 25 juni 2026

**Thema:** Scraper-uitbreidingen (The Collection, Extra Horses), volledige
3-generatie-stamboom via Hippomundo, en een grote UI-opruimbatch.

Lange sessie met vijf samenhangende stukken. Alles staat op `main` en is
gedeployed (Vercel). Eén additieve migratie (0036) staat in productie.

---

## 1. The Collection herkend (weauction) — registry

The Collection (vrijdag 3 juli 2026) draait op het weauction-platform.
Alleen de registry herkende de host nog niet.

- `src/lib/scraperRegistry.js`: host `bid.thecollection-auction.com` + huisnaam
  "The Collection".
- Commit `e71399e`, merge `661aa8f`.

## 2. Extra Horses (Megève, 17 juli 2026) — nieuwe scraper

Nieuw platform. Kale `fetch` met **volledige browser-User-Agent** volstaat
(geen Puppeteer). 21 lots opgehaald en geïmporteerd.

- Nieuw `scripts/scrape-extrahorses.mjs` (harde fout bij 0 lots; embryo-jaar
  bewust leeg + getraceerd in `missing_info`; robuuste datum-parse uit de titel).
- Registry-entry + tests. Commit `7509a48`, merge `6e456e8`.

## 3. The Collection binnenhalen — aparte scraper voor de nieuwe weauction-frontend

The Collection draait een **nieuwere** weauction-frontend (Tailwind) dan Aloga,
met een schone JSON-API. De bewezen `scrape-weauction.mjs` (Aloga/WEF) is
**ongewijzigd** gebleven; een aparte variant doet de nieuwe frontend.

- Nieuw `scripts/scrape-weauction-api.mjs` — leest
  `/api/auctions/<id>/Items/published`. Registry routet per host (The Collection
  → nieuw; Aloga/WEF/… → oud). `buildArgs` geeft de collectienaam door zodat
  "Collectie ophalen" geen duplicaat maakt.
- Commit `f38260b`, merge `a3838fb`.

## 4. Volledige 3-generatie-stamboom (Hippomundo)

Eerst leek de stamboom niet scrapebaar (Hippomundo-embed → Cloudflare-403 op een
kale fetch). Met een **echte browser (Puppeteer)** wordt Cloudflare wél opgelost
en rendert de boom; we parsen de bracket op **geometrie** naar `lots.pedigree`
(3 generaties, mét de échte moeder).

- Twee valkuilen opgelost: **verse browser per lot** (Cloudflare escaleert anders
  na de eerste navigatie), en **haakjes-annotaties "(Naam)" wegfilteren**
  (Hippomundo geeft een naamloze merrie nooit de naam van de moedersvader —
  dank aan Frederiks scherpe controle).
- `import-lots.mjs` slaat `pedigree` nu op (additief). Nieuw
  `scripts/update-pedigree-from-scrape.mjs` vult pedigree/sire/dam/missing_info
  van bestaande lots **niet-destructief** bij.
- Commit `50bdf5c`, merge `56c9bbd`.

**Databasewerk (buiten git):**
- 21 The Collection-lots verrijkt met volledige stamboom (idempotent gepatcht).
- Een **dubbele collectie** opgeruimd: "The Collection 2026" (per ongeluk via de
  webapp aangemaakt) verwijderd; **"The Collection Live 2026"** behouden, met de
  bron-URL gekoppeld. (Op Frederiks keuze.)

## 5. UI-opruimbatch + beheer-consolidatie

Migratie **0036** (additief): `collections.archived` + `auction_houses.archived`.

- **Archiveren én verwijderen** voor zowel veilingen als veilinghuizen, met een
  "Toon gearchiveerd"-schakelaar en herstellen. Alles zit nu onder één
  **"Beheren"**-knop per pagina (rustiger bovenbalk).
- Knoppen subtieler (groene/rode outline i.p.v. vol gekleurd); "Lid toevoegen"
  idem.
- Worker-status verplaatst naar **rechts** in het rijtje (niet weg).
- "Catalogus ophalen" → **"Collectie ophalen"** (overal dezelfde term).
- **Cockpit-fix:** bij een meerdaagse veiling (Deauville) staat de
  "🎬 Open cockpit"-knop nu **per dag altijd zichtbaar** bovenaan — en niet meer
  verstopt in de metadata-bewerker.
- **Lot-pagina:** twee beschrijvingsvelden duidelijk gelabeld ("Catalogustekst
  (van de website)" / "Mijn beschrijving"); zwervende "·"-status­puntjes weg;
  "Markeer als niet-deelnemend" onder het discipline/geslacht/stamboek-blok.
- Nieuw `src/lib/houses.js` (archiveren + cascade-verwijderen).
- Commits: UI-batch → merge `9b42856`; beheer-consolidatie `6dae633` → merge `137c6d2`.

---

## Wat zou er fout kunnen gaan / visueel te controleren

- **Huis verwijderen is destructief** (cascade: alle veilingen + lots). De
  bevestig-modal toont de telling; gebruik liever Archiveren om data te bewaren.
- **Stamboom-scrape** leunt op een externe Hippomundo-embed + Cloudflare; per lot
  een verse headless browser. Trager (~1-2 min voor 21 lots) maar binnen de
  worker-timeout (10 min). Als Hippomundo zijn pagina-opbouw wijzigt, kan de
  geometrie-parser opnieuw afgesteld moeten worden.
- **Cockpit per dag** (Deauville): controleer dat beide dagen een knop tonen en
  naar de juiste dag-cockpit gaan.
- **Archiveren**: gearchiveerde veilingen/huizen verdwijnen uit de gewone lijst;
  terugvinden via "Toon gearchiveerd" in de Beheren-modus.

## Rollback

- Code: `git revert <merge-hash>` of via Vercel → vorige deployment.
- Migratie 0036 is puur additief (twee booleaanse kolommen, default false) —
  geen rollback nodig; ongebruikt laten is onschadelijk.

## Open punten (overgedragen aan Frederik)

- **Vóór 3 juli**: The Collection-catalogus opnieuw controleren als er paarden
  bijkomen/wijzigen (her-scrape-merge op lot-niveau is nog geparkeerd — een
  re-import in een collectie die al lots heeft, wordt nu geweigerd).
- **Visuele test** van de UI-batch op de live site (alle punten hierboven).
- Hippomundo blijft een externe afhankelijkheid achter Cloudflare; geen publieke
  API. De stamboom-scrape is best-effort.
