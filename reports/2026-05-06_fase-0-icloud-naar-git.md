# Audit — Fase 0: iCloud → git/GitHub-overgang + documentatie-update

**Datum:** 6 mei 2026 (eerste post-Aloga sessie)
**Sessie:** Code (vanaf MacBook)
**Type:** Foundation — geen feature-werk, alleen sync-route en docs

---

## Context

POST_ALOGA_ROADMAP.md was op 5 mei geschreven met de aanname dat het
project naar iCloud Drive verhuisd zou worden om sync tussen Mac mini
en MacBook mogelijk te maken. Fase 0 in de roadmap (regels 358-366)
bevatte stappen om `node_modules` uit iCloud-sync te houden, file-
watching tijdens `npm run dev` te testen, en de drie iCloud-valkuilen
(node_modules-corruption, .git/index.lock-conflicten, file-eviction)
te documenteren.

In deze sessie is besloten **niet** voor iCloud te kiezen, maar voor
git/GitHub als sync-mechanisme. Reden: iCloud + Node.js-projecten +
git is een combinatie die in de praktijk regelmatig leidt tot
corruptie en sync-conflicten. Git is precies daarvoor ontworpen.

Het project is daarom uit iCloud verplaatst en de iCloud-kopie is naar
de Prullenbak verplaatst (recoverable tot ~6 juni). Werkmap is weer
`~/veiling-pro/` zoals vóór 5 mei.

---

## Wat is er gewijzigd in deze sessie

### Bestandssysteem-acties

- iCloud-projectmap (`~/Library/Mobile Documents/com~apple~CloudDocs/veiling-pro/`)
  verplaatst naar `~/.Trash/veiling-pro-icloud-backup/`
- Verse clone van `https://github.com/frederikdbacker/Veiling-Pro.git`
  in `~/veiling-pro/`
- `npm install` (84 packages, geen errors)
- `.env.local` apart gekopieerd vanuit iCloud-versie naar `~/veiling-pro/.env.local`
  (gitignored, kan niet via git)

### Git-commits

- **2a3bbd3** `docs: post-aloga roadmap, session-opener fase 0 en
  vercel-deploy-audit` — drie untracked docs gecommit die in de iCloud-
  versie waren ontstaan tussen 2 mei en 5 mei. Reports die per ongeluk
  in de iCloud-root waren beland zijn teruggezet in `reports/`.

### Documentatie-updates (deze sessie)

- **HANDOVER.md** — gotcha #6 uitgebreid met geschiedenis-alinea over de
  iCloud-rondreis (5 mei verhuis → 6 mei terug).
- **POST_ALOGA_ROADMAP.md** — twee UPDATE-noten ingevoegd: één bij
  "Belangrijke wijziging" (regels 22-58) en één bij "Fase 0 — iCloud-
  setup" (regels 358-366). De originele tekst is bewaard voor historische
  referentie.
- **DEVELOPER_SETUP.md** — datum gebumpt naar 6 mei. Nieuwe sectie
  "Multi-machine sync (Mac mini + MacBook)" toegevoegd na "Project klonen".
- **MASTER_PROMPT.md** — datum gebumpt naar 6 mei. Geen inhoudelijke
  wijziging (paden waren al correct).
- **PROJECT_STATUS.md** — datum + deadline-blok geüpdatet (Aloga 2026
  voorbij). Korte pointer toegevoegd dat Fase 0 voltooid is en de rest
  van het document nog van 2 mei is.

### Verificaties

- `npm run build` slaagde in 902 ms (112 modules, 1 chunk-warning over
  bundlegrootte 532 kB — bestaand, geen regressie).
- `npm run dev` opent vlot op http://localhost:5173, demo-flow doorlopen
  en visueel bevestigd door Frederik ("werkt").

---

## Wat zou fout kunnen gaan

- **Andere Mac (Mac mini)** heeft mogelijk nog de iCloud-versie als
  werkmap. Bij eerstvolgende sessie op die machine: ofwel verse `git
  clone` in `~/veiling-pro/` doen en de oude iCloud-werkmap wegdoen,
  ofwel de iCloud-werkmap via Finder uit iCloud halen en in `~/`
  zetten. **Niet doorwerken in de iCloud-versie** — anders divergeren
  de twee Macs alsnog.
- **`.env.local` op tweede Mac** zit niet in git en moet apart
  gekopieerd worden (USB, AirDrop, of handmatig overtypen vanuit
  Supabase Dashboard → API Keys → Publishable key).
- **Vercel env vars** zijn niet aangeraakt — die zaten al goed
  geconfigureerd vóór deze sessie. Productie-deploy zou onveranderd
  moeten werken.
- **Pad-referenties in scripts** — `scripts/import-lots.mjs` en andere
  Node-scripts gebruiken relatieve paden, niet `~/veiling-pro/` hardcoded.
  Geen wijziging nodig, maar waarschuwing: als ergens toch het iCloud-
  pad hardgecodeerd zou staan, zal dat falen. Niet aangetroffen tijdens
  deze sessie, maar niet exhaustief gegrep't.
- **`.claude/settings.local.json`** met permissies wordt automatisch
  per sessie aangevuld door Claude Code zelf — file is gemerged uit de
  iCloud-versie en de fresh-clone-versie. Geen verlies van permissies.

---

## Wat moet visueel gecontroleerd worden

1. **Productie nog steeds gezond**: na de doc-only commit + push (STAP 7)
   moet `https://veiling-pro.vercel.app` nog steeds werken. Doc-wijzigingen
   raken geen runtime-code, dus dit zou triviaal moeten zijn — maar
   altijd checken.
2. **Demo-flow op productie**: HousesPage → AuctionPage → LotPage →
   Cockpit, alle vier moeten openen zonder errors.
3. **Tweede Mac later**: na verse clone op Mac mini, dezelfde demo-flow
   doorlopen om te bevestigen dat de migratie naar git-only-sync compleet
   is.

---

## Hoe rollback indien nodig

### Doc-wijzigingen terugdraaien

```bash
cd ~/veiling-pro
git log --oneline | head -5
git revert <hash van de Fase-0 commit>
git push
```

### Volledige iCloud-rondreis terugdraaien

Onwaarschijnlijk nodig, maar mogelijk:

1. iCloud-backup uit Prullenbak halen via Finder → terugzetten op
   `~/Library/Mobile Documents/com~apple~CloudDocs/veiling-pro/`
2. `~/veiling-pro/` weghalen of hernoemen
3. Werken vanuit iCloud-locatie

**Niet aanbevolen** — de redenen om weg te gaan van iCloud zijn niet
veranderd. Maar de optie staat 30 dagen open.

### Vercel-deploy

Geen runtime-code gewijzigd, dus geen deploy-rollback nodig of mogelijk.
Mocht een Vercel-deploy om andere reden falen: dashboard → Deployments
→ vorige Ready → Promote.

---

## Resterend werk

- **Mac mini overstappen** op git-only sync (zie boven)
- **Pre-fase Supabase-checks** uit POST_ALOGA_ROADMAP.md regels 506-523
  doen vóór Fase 1 start (3 tabel-checks: `lots` URL-velden, `lot_types`
  seed-rows, `client_auction_seating` kolommen)
- **Spotter-bug** (#19+20 uit roadmap): exacte foutmelding van Frederik
  ontvangen — kan prioritair vóór Fase 1 als die bug nu actief hindert
- **Bundlegrootte-warning** (532 kB) — bestaand, geen Fase 0-werk

---

## Volgende stap

Na commit + push van Fase 0: kiezen tussen Fase 1 (quick wins —
items 3, 9, 4, 10b, 16) of de spotter-bug eerst.
