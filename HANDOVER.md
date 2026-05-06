# HANDOVER — Veiling-Pro op 30 april 2026

> **Doel van dit document**: zodat de volgende sessie binnen 5 minuten weet
> waar we staan, wat werkt, en wat het volgende doen is. Niet alle historie —
> alleen het nodige om te kunnen starten.
>
> **Live status / volledige to-do**: zie `PROJECT_STATUS.md`
> **Wat is er gebeurd op een dag**: zie `reports/<datum>_*.md`
> **Werkwijze-regels**: zie `MASTER_PROMPT.md`

---

## In één zin

Voorbereidingsmodule, bid-step-systeem en cockpit (3 van 6 stappen) draaien
end-to-end voor Aloga Auction 2026 (5 mei). De cockpit is **bruikbaar
zoals hij is** — Frederik kan op 5 mei werken zonder verdere wijzigingen.
Twee laatste features op de wachtlijst: cockpit-statusbalk en overzichts-
pagina einde veiling.

## Drie belangrijkste URL's

- **GitHub**: https://github.com/frederikdbacker/Veiling-Pro
- **Supabase Dashboard**: https://supabase.com/dashboard/project/cjxtwzmryrpwoydrqqil
- **App lokaal**: `cd ~/veiling-pro && npm run dev` → http://localhost:5173

## Demo-flow om te checken dat alles draait

In deze volgorde (5-10 min):

1. **`/`** → Aloga zichtbaar als veilinghuis
2. **klik Aloga** → Aloga Auction 2026 met datum + locatie
3. **klik Aloga Auction 2026** → 24 lots met thumbnails, lot-types-selector
   met 2 aangevinkt, biedstappen-editor (mogelijk leeg)
4. **klik een lot** (bv. Master of Paradise) → volledige info (foto's,
   catalog, EquiRatings, externe links blok, voorbereiding, notities)
5. **terug naar AuctionPage**, klik **🎬 Cockpit openen**
6. **Selecteer een lot** → panel met alle scraped info
7. **klik IN DE PISTE → START BIEDEN → HAMER**, kies "Verkocht in zaal",
   typ €1000, bevestig → resultaat-regel
8. **klik Volgend lot →** → state reset op nieuwe lot

Werkt dit doorheen? Dan is de stack gezond.

## Volgende sessie — eerste actie

**Cockpit-statusbalk + sessie-statistieken** (Frederik's twee laatste vragen
op 30-04). Voorgesteld plan:

```
Bovenaan of onderaan de cockpit, altijd zichtbaar:
  Lot 12 / 24  ·  6 verkocht  ·  3 niet verkocht  ·  Voorlopige omzet €72.000
  Gem. duur per lot 02:14  ·  Verwacht einde 21:55
```

Implementatie-aanwijzing:
- `allLots`-fetch in `CockpitPage.jsx` uitbreiden met `time_hammer`,
  `duration_seconds`, `sale_price`, `sold` zodat statistieken lokaal
  berekend kunnen worden zonder extra query.
- Lokale sync in `onLotUpdated` callback: ook `allLots` updaten.
- Subcomponent `SessionStats` of inline section binnen `CockpitControls`.

**Daarna**: overzichtspagina einde veiling (`/auctions/:id/summary` of
`/auctions/:id/result`). Toont:
- Tabel: alle 24 paarden met verkoopprijs + sold/niet-verkocht + kanaal
- Totale omzet
- Gem. prijs per lot-type
- Gem. prijs per paard (over verkochte)
- Knop "Overzicht openen" verschijnt op cockpit zodra alle paarden
  gehamerd zijn (of altijd zichtbaar als je wilt)

## Project-state op één pagina

### Code-paden
- 22 commits op `main`, alles gepusht naar GitHub
- React 18 + Vite 5 + react-router-dom v7 + Supabase JS-client v2
- Build groen — `npm run build` slaagt zonder errors (94 modules)

### Database (Supabase, project `cjxtwzmryrpwoydrqqil`)
8 tabellen:
- `auction_houses` — 1 row (Aloga)
- `auctions` — 1 row (Aloga Auction 2026, 5 mei 20:00 Sentower Park)
- `lots` — 24 rows, allemaal verrijkt
- `lot_types` — 8 rows (seed)
- `auction_lot_types` — 2 rows (Aloga × springen, Aloga × dressuur)
- `bid_step_rules` — afhankelijk van wat Frederik instelde
- `clients` — leeg, junction `lot_interested_clients` ook leeg
- 6 migraties uitgevoerd (0001 t/m 0006)

### Werkende UI
- `/` lijst van veilinghuizen
- `/houses/:id` veilingen voor huis
- `/auctions/:id` 24 lots + types-selector + biedstap-editor
- `/lots/:id` volledig paard-detail met inline edit (cijfers + URL's)
  en notitievelden
- `/cockpit/:id` live cockpit (read-only info + drie-knop-flow + hamer-form)

### Wat is uitgesteld of geschrapt
- **Klanten-UI** (was 0b in plan): schema bestaat, UI op LotPage komt later
- **Cockpit stap 4** (huidig-bod input): geschrapt — Frederik typt enkel
  finale prijs in hamer-form
- **Cockpit stap 5** (notities-bewerkbaar in cockpit): nog niet gebouwd
- **Cockpit stap 6** (sessie-statistieken): nog niet gebouwd, maar uitgebreid
  in scope na Frederik's input van 30-04 (zie statusbalk hierboven)
- **Vercel-deployment**: nog niet geconfigureerd
- **Drop deprecated columns** (`lots.bid_steps` text, `lots.lot_type` text):
  ongebruikt maar staan nog

## Praktische gotchas

### 1. Twee FK-relaties tussen `lots` en `auctions`
Sinds migratie 0004 bestaan er twee relaties (`lots.auction_id → auctions`
en `auctions.active_lot_id → lots`). PostgREST kan niet auto-disambigueren
bij embed-queries. Gebruik altijd expliciete FK-naam, bv:
```js
.select('*, auctions!auction_id(...)')
```
Andere richting (auctions embedt lots): vergelijkbaar voorzorg nodig
zodra die query gebruikt wordt.

### 2. RLS staat permissive open
Alle tabellen: `for all using (true) with check (true)`. Wie de URL kent,
kan bewerken. **Niet voor publieke/deelbare deploy** zonder eerst auth +
per-user RLS in te bouwen.

### 3. State-stale na lot-wisseling op LotPage
Opgelost in commit `93bcfb6`: `setLot(null)` aan het begin van useEffect
om stale data te vermijden bij navigeren tussen lots. Dezelfde pattern
toegepast bij CockpitPage's actief-lot effect. Houd dit patroon aan voor
toekomstige soortgelijke wissels.

### 4. Lots zonder `lot_type_id`
Als Frederik een type uitvinkt op AuctionPage, blijven lots met dat
type-id ge-tagd in DB maar het type is "verstopt". Op LotPage toont
de dropdown dan "— kies —" voor zo'n lot. Bewust: opnieuw aanvinken
herstelt zichtbaarheid zonder data te verliezen.

### 5. Alle test-data van 30-04 is gereset
Total Secret en Valsero waren tijdens testen gehamerd in oude flow.
Beide zijn op 30-04 via REST PATCH gereset (alle timer-velden + sold/
sale_price/sale_channel/duration_seconds = NULL). Vrij om opnieuw te
testen op 5 mei zelf, of nu, of nooit.

### 6. iCloud-sync of niet?
`~/veiling-pro/` zit NIET in iCloud Drive. Sync tussen Mac mini en
MacBook gaat via GitHub. Als je op de andere Mac werkt: `git pull`
voor je begint.

**Geschiedenis:** op 5 mei 2026 is de projectmap kort naar iCloud
verplaatst (zie POST_ALOGA_ROADMAP.md). Op 6 mei is dat teruggedraaid
omdat iCloud + Node.js + git slecht samengaan: `node_modules`
corrumpeert tijdens sync, `.git/index.lock` raakt in conflict bij
gelijktijdige edits van twee Macs, en bestanden worden door iCloud
soms ge-evict (alleen-in-cloud) waardoor de build breekt. Git is
het juiste antwoord voor multi-Mac code-sync — dat blijft zo.

## Wat NIET aanraken zonder plan

- `supabase/migrations/0001-0006` — al uitgevoerd, niet wijzigen
- `data/aloga-2026-import.json` — broninput, alleen voor traceability
- `.env.local` — bevat publishable key, NOOIT committen

## Hoe een nieuwe sessie starten

```bash
cd ~/veiling-pro
claude
```

Eerste opdracht (uit MASTER_PROMPT.md regel 90):

> "Lees PROJECT_STATUS.md, MASTER_PROMPT.md en DEVELOPER_SETUP.md voor
> context. Werkwijze uit deze documenten geldt onverkort. De gebruiker is
> niet-technisch, dus klein-stappen-werkwijze met visuele bevestiging na
> elke stap. Daarna: cockpit-statusbalk + sessie-statistieken bouwen
> volgens HANDOVER.md."

Eventueel `npm run dev` in een aparte terminal openen voor live preview.

---

**Slotnotitie**: 4 commit-iteraties op 30 april — voorbereidingsmodule,
inline-edit, bid-step-systeem, cockpit. 22 commits, 6 migraties, 24 lots
volledig verrijkt. Stack is klaar voor Aloga 2026 op 5 mei.
