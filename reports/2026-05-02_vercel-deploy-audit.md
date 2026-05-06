# Audit — Vercel deployment Veiling-Pro

**Datum:** 2 mei 2026
**Sessie:** Chat (MacBook), Mac Mini niet beschikbaar
**Type:** Infrastructure / deployment — géén code-werk in repo (één klein config-bestand toegevoegd via GitHub web)

---

## Wat is er gewijzigd

1. **Vercel-account gekoppeld aan GitHub** — eenmalig, autoriseert deploys vanaf `frederikdbacker/Veiling-Pro`.
2. **Vercel-project aangemaakt** — naam `veiling-pro`, framework preset `Vite`, gekoppeld aan branch `main`.
3. **Twee Environment Variables** op Vercel:
   - `VITE_SUPABASE_URL` = `https://cjxtwzmryrpwoydrqqil.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `[publishable key uit Supabase]`
4. **Eerste deploy** succesvol op commit `0800cbb` (laatste docs-commit op `main`).
5. **`vercel.json` toegevoegd** in repo-root via GitHub web UI:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   Reden: SPA-fallback zodat deeplinks zoals `/cockpit/:id` of `/lots/:id` niet 404 geven op Vercel.
6. **Tweede deploy** automatisch getriggerd door die commit — succesvol.

---

## Live URLs

- **Production:** https://veiling-pro.vercel.app
- **Bookmark voor iPad op 5 mei:** https://veiling-pro.vercel.app

---

## Wat is getest in deze sessie

- ✅ Homepage `/` toont Aloga-veilinghuis
- ✅ `/houses/:id` toont Aloga Auction 2026
- ✅ `/auctions/:id` toont 24 lots met thumbnails
- ✅ `/lots/:id` toont volledig detail (foto-gallery, catalogtekst, EquiRatings, URLs)
- ✅ `/cockpit/:auctionId` toont cockpit (na `vercel.json`-fix)
- ✅ Supabase-verbinding in productie werkt (PostgreSQL UUID-validatie reageert correct)

---

## Wat zou fout kunnen gaan

- **iPad/iPhone Safari** is nog niet getest in productie. Cockpit-timer en state-machine zouden moeten werken, maar pas op 5 mei in echte conditie verifieerbaar.
- **Realtime updates van Supabase** (subscription op lots-tabel) niet apart getest op Vercel. WebSockets door Vercel zijn standaard ondersteund, dus geen reden voor zorg, maar wel checken bij eerste live cockpit-test.
- **Env-variabelen verdwijnen niet vanzelf**, maar bij accidentele wis in Vercel-dashboard staat de app stuk. Backup van publishable key elders bewaren als veiligheid.

---

## Wat moet visueel gecontroleerd worden vóór 5 mei

- [ ] Cockpit openen op iPad landscape — past alles? Knoppen groot genoeg?
- [ ] Drie-knop-flow doorlopen op iPad: IN DE PISTE → START BIEDEN → HAMER
- [ ] Hamer-form: bedrag invoeren + bevestigen → resultaat-regel verschijnt
- [ ] Volgend lot → navigatie werkt vlot
- [ ] Test slechte WiFi (telefoon-hotspot beperken) — blijft cockpit responsive?

---

## Hoe rollback indien nodig

**Volledige rollback van Vercel-deploy:**
1. Vercel dashboard → Veiling-Pro → **Deployments**
2. Vorige deploy met groen Ready-bolletje → drie-puntjes-menu → **Promote to Production**
3. Live URL serveert binnen ~30 sec de vorige versie.

**Rollback van `vercel.json`** (alleen als die problemen geeft — onwaarschijnlijk):
1. GitHub web → `vercel.json` → potlood-icoon → bestand verwijderen
2. Commit → Vercel deployt zonder rewrites
3. Gevolg: deeplinks geven weer 404. Liever niet doen.

---

## Resterend werk vóór 5 mei (volgende code-sessie op Mac Mini)

In volgorde van belang:

1. **Cockpit-statusbalk** — altijd zichtbaar bovenaan/onderaan: "X/24 lots · Y verkocht · Z niet verkocht · Voorlopige omzet €N"
2. **Cockpit stap 6** — sessie-stats (gem. duur per lot + verwacht einduur), past in dezelfde balk
3. **Overzichtspagina einde veiling** — `/auctions/:id/summary` met totaaloverzicht, omzet, gemiddelde prijs per lot-type
4. **Cockpit stap 5** — notities bewerkbaar in cockpit
5. **Eindtijd Aloga invullen** — REST PATCH, 30 sec werk

---

## Volgende code-sessie — opstartstappen

Op Mac Mini, in `~/veiling-pro/`:

```bash
git pull              # haal vercel.json en deze audit op
npm install           # voor het geval er deps wijzigden
npm run build         # check dat lokale build slaagt
claude                # start nieuwe Claude Code sessie
```

**Eerste prompt in Claude Code:**
> "Lees PROJECT_STATUS.md, MASTER_PROMPT.md, DEVELOPER_SETUP.md, en reports/2026-05-02_vercel-deploy-audit.md voor context. Werkwijze uit deze documenten geldt onverkort. Daarna: bouw de cockpit-statusbalk inclusief sessie-statistieken (taken 1+2 uit het audit-rapport) — plan-mode verplicht."

---

## Documenten-update — TODO in volgende sessie

Volgens MASTER_PROMPT principe 4 worden de drie documenten samen bijgewerkt op dezelfde datum:

- **PROJECT_STATUS.md:** schrap "Vercel-deployment" uit open punten, voeg vercel.json + live URL toe, datum naar 2 mei
- **DEVELOPER_SETUP.md:** notitie over `vercel.json` + live URL `veiling-pro.vercel.app`, datum naar 2 mei
- **MASTER_PROMPT.md:** alleen datum naar 2 mei (inhoud ongewijzigd)

Dit audit-rapport zelf moet verplaatst naar `reports/2026-05-02_vercel-deploy-audit.md` in de repo (zit nu nog op MacBook in `~/`).
