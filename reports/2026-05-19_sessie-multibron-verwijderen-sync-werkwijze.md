# Audit — sessie 18–19 mei 2026

**Thema:** Werkwijze vastgelegd · multi-bron scrapers · veiling verwijderen
(nieuw UX) · comitéleden Hannoveraner · veilige multi-Mac sync · herstel na
verouderde werkkopie.

Gewone taal voor Frederik. Wat is gewijzigd · wat kan misgaan · wat visueel
controleren · hoe terugrollen.

---

## Belangrijkste incident (en les)

Een groot deel van dag 1 is per ongeluk gewerkt op een **verouderde lokale
kopie** (~70 commits achter op GitHub). Veel van dat werk bleek al in het
echte project aanwezig. Opgelost: lokale `main` veilig gelijkgezet aan
GitHub, dag-1-werk bewaard op back-up-branches, en een vaste sync-routine
ingevoerd zodat dit niet meer gebeurt. **PR #1 is gesloten (niet gemerged).**

## Wat is er gewijzigd en staat nu op `main` (live via Vercel)

1. **Veilig sync-script `bin/sync.sh`** — `pull` (alleen fast-forward, kan
   nooit werk overschrijven), `done "tekst"` (build-check → commit → push,
   nooit geforceerd, nieuwe bestanden enkel met `+new`), `status`.
   `DEVELOPER_SETUP.md` verwijst er nu naar i.p.v. het onveilige
   `git add . && commit && push`.
2. **Veiling verwijderen — nieuwe UX**: één knop **"− Veiling verwijderen"**
   naast **"+ Veiling toevoegen"** → keuzemenu (dropdown) → bevestiging
   (naam + aantal lots) → FK-veilige cascade. Geen prullenbak per rij meer.
3. **PWB-scraper** `scripts/scrape-pwb.mjs` (horseauctionbelgium.com +
   paardenveilingonline.com) in projectstijl → `data/pwb-*.json` →
   `import-lots.mjs`. Robuuste getagde-x-split (breekt geen namen als
   "Nixon"). Getest: HAB 27 + PVO 60 lots (niet geïmporteerd).
4. **`CLAUDE.md`** — dunne wegwijzer (auto-ingeladen) naar de drie
   werkwijze-docs; **geen duplicaat**. De 3 docs blijven leidend.

## Wat is er rechtstreeks in de database (Supabase) gebeurd

- **Verden Auction YoungSTARS OnLive** (`4265d846…`): 84 lots geïmporteerd
  inclusief 3-generatie afstamming.
- Lege duplicaat **"Verden … (Foals)"** (`eee331da…`) verwijderd.
- **5 comitéleden** toegevoegd bij **Hannoveraner Verband** (Wilken Treu,
  Andreas Homuth, Lisa von Aspern, Thomas Schönig, Steffen Werner).

Deze DB-acties zijn al actief en staan los van code-deploys.

## Wat kan misgaan / aandachtspunten

- De "Collectie via URL"-import-feature van dag 1 (multi-bron registry,
  HORSE24-adapter) is **niet** gemerged — die zat op de verouderde basis en
  het echte project heeft eigen scrapers. Bewaard op back-up-branch.
- Zangersheide-foto's laden client-side (bekende beperking, los van deze
  sessie).
- PWB-scraper is enkel op extractie getest, nog niet via een echte import
  in Supabase.

## Wat jij visueel moet controleren

1. Na de Vercel-deploy: `/houses/d1493806-095e-4688-842b-de82ca1291b5`
   - "− Veiling verwijderen" → dropdown → annuleren werkt, lijst blijft schoon.
   - Onderaan: 5 comitéleden zichtbaar.
2. Verden-veiling: 84 lots; open een lot → afstamming over 3 generaties.

## Hoe terugrollen

- Code: elke wijziging is een aparte commit op `main`; `git revert <hash>`
  per feature. Branches `backup/sessie-2026-05-18-werkwijze-audit` en
  `feat/collectie-url-import-multibron` bewaard.
- Database: verwijder-knop op de huis-pagina, of handmatig in Supabase
  (maak eerst een export — werkwijze-principe 8).

## Git-overzicht

- `main`: sync-script, doc-update, verwijder-UX, PWB-scraper, CLAUDE.md +
  dit rapport. In sync met GitHub.
- Gesloten: PR #1 (verouderd). Gemerged: PR #2, #3, #4.
- Back-up-branches bewaard (zie boven).

## Werkwijze-naleving deze sessie

- Build-check vóór elke commit (`npm run build`) — telkens groen.
- Audit in gewone taal (dit hoofdstuk in chat) + dit markdownbestand
  (principe 7 + 10).
- Openstaand t.o.v. principe 5 (3-doc-set op dezelfde datum): enkel
  `DEVELOPER_SETUP.md` is aangepast; `MASTER_PROMPT.md`/`PROJECT_STATUS.md`
  zijn **bewust niet** geblind bijgewerkt (niet volledig gelezen — principe
  2). Een formele 3-doc-update op datum kan op verzoek, apart.
