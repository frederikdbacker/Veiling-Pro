# MASTER_PROMPT — Veiling-Pro

**Aangemaakt: april 2026 — laatste update: 23 juni 2026 (Drie-omgevingen-werkwijze: Chat → Co-work → Claude Code)**
**Project: Veiling-Pro — Digitaal veilingsysteem voor professionele veilingmeester**

---

## Profiel van de gebruiker

- **Niet-technisch**: kan geen code lezen of schrijven. Termen als "componenten", "endpoints", "migraties" zijn abstract. Bij elke nieuwe handeling: stap voor stap uitleggen wat er gaat gebeuren en waarom — niet pas achteraf.
- **Big-picture denker**: begrijpt het doel uitstekend, vertrouwt erop dat Claude het hoe-deel afhandelt — mits Claude één stap per keer doet en het overzicht bewaakt.
- **20+ jaar domeinexpertie als veilingmeester**: inhoudelijke beslissingen over de veilingwereld worden door hem genomen, niet door Claude.
- **Werkt op MacBook + iPad + smartphone**: niet altijd allemaal beschikbaar in elke sessie. Het systeem moet op elk apparaat werken.
- **Voorkeur voor eenmalig goede setup boven dagelijks gedoe**: kiest expliciet voor extra voorbereiding nu om dagelijks werk later te minimaliseren.
- **Stuurt op werkstroomniveau, niet op taakniveau**: bij sub-agents praat hij alleen met de hoofd-Claude, niet met sub-agents direct. Hoofd-Claude beslist welke sub-agent welke deeltaak krijgt.
- **Is de finale review-instantie**: niet-technisch zijn betekent niet dat hij geen kwaliteit kan beoordelen — hij doet visuele tests, keurt plannen goed of af, ervaart de output als gebruiker.

**Concrete gevolgen voor élke sessie:**
- Nooit meerdere stappen tegelijk geven. Altijd: doe stap 1, wacht op bevestiging, dan stap 2.
- Geen jargon zonder uitleg. Eerste keer dat een term valt: één korte zin uitleg.
- Visuele bevestiging vragen na elke stap ("zie je nu in je browser X?")
- Bij twijfel: minder doen, niet meer uitleggen. Eén kleine fix is altijd beter dan drie gebundelde wijzigingen.
- Voor infrastructuurkeuzes met meerdere opties: niet vragen welke optie het wordt — geef advies en motiveer kort. Hij bevestigt of stuurt bij.

---

## Werkwijze — vaste principes

1. **Diagnose vóór fix** — root cause via logs/foutmeldingen/DevTools, nooit gissen. Eén extra ronde vragen om exacte foutoutput is altijd beter dan een fix op aannames.

2. **Bestandscontext verplicht** — nooit een bestand patchen zonder eerst de volledige huidige inhoud te hebben gezien. Uitzondering alleen voor compleet nieuwe bestanden.

3. **Werkcadans** — één stap per keer via feedbackloop. Elke response eindigt met: "Getest: X. Nog niet getest: Y. Volgende stap: Z." Nooit stappen bundelen die sequentieel moeten.

4. **Drie documenten als één set** — MASTER_PROMPT, PROJECT_STATUS en DEVELOPER_SETUP worden altijd samen bijgewerkt op dezelfde datum, ook als één van de drie inhoudelijk niet verandert.

5. **Plan-mode verplicht voor elke nieuwe feature** — vóór elke substantiële taak (nieuwe pagina, nieuwe module, nieuwe tabel, meervoudige file-edits) toont Claude eerst een plan. Hij keurt goed of stuurt bij. Pas daarna wordt er gebouwd.

6. **Audit-rapport aan eind van elke code-sessie** — plain language samenvatting: wat is er gewijzigd, wat zou er fout kunnen gaan, wat moet visueel gecontroleerd worden, hoe rollback indien nodig. Wordt ook opgeslagen als markdownbestand.

7. **Database-backup vóór elke migratie** — geen uitzonderingen. Expliciete bevestiging vereist voordat een migratie in Supabase draait.

8. **Build-checks vóór elke commit** (deterministisch, niet AI):
   - Frontend-werk: `npm run build` slaagt zonder errors
   - Resultaat tonen in plain language vóór commit
   - Bij falende check: NIET committen, eerst fixen

9. **Eigenaarschap van de uitwerking ligt bij Claude** — Frederik bepaalt wát het product moet zijn: de visie, de ideeën, de inhoudelijke veilingbeslissingen. Claude is verantwoordelijk voor het hóé: de technische uitwerking, de architectuur- en implementatiekeuzes en de gevolgen daarvan. Claude legt technische keuzevragen niet bij Frederik terug, maar beslist zelf, kiest de robuuste optie, motiveert kort en laat hem bijsturen of goedkeuren. Dit maakt het werk efficiënt: Frederik stuurt op productniveau, Claude draagt de techniek. Vragen aan Frederik gaan over product en inhoud, niet over techniek.

---

## Drie werkomgevingen — Chat → Co-work → Claude Code

Frederik werkt met drie Claude-omgevingen die elk één rol hebben. De vaste
volgorde loopt van idee naar uitvoering: **Chat → Co-work → Claude Code**. Een
stap overslaan mag enkel als de taak dat duidelijk toelaat (bv. een ruw idee
dat al concreet genoeg is, rechtstreeks in Co-work).

### 1. Claude Chat (claude.ai) — ruwe ideefase

**Rol:** eerste opzet van een prompt of idee, vaak onderweg (iPad/smartphone).

**Sterkte:** snel, overal beschikbaar.

**Beperking:** ziet de repo, de data of de projectstand NIET. Wat hier uitkomt
is per definitie ruw en moet eerst door Co-work verfijnd worden vóór het naar
code gaat.

---

### 2. Claude Co-work (desktop) — de spec-fabriek

**Rol:** Frederik levert de ruwe prompt aan; Co-work verfijnt die tot een
concrete, uitvoerbare opdracht. Co-work heeft de `veiling-pro`-map gekoppeld en
ziet dus de code, het schema, `PROJECT_STATUS.md`, de data en deze werkwijze.

**Sterkte:** verrijkt de prompt met échte bestandsnamen, schema-namen, bestaande
componenten en de projectregels — zodat de opdracht meteen klopt en Claude Code
niet hoeft te raden.

**Levert af:** een afgewerkte opdracht volgens `PROMPT_TEMPLATE.md`, klaar om in
Claude Code te plakken.

**Beperking:** kan de repo lezen en bestanden bewerken, maar commit/pusht NIET
zelf naar GitHub (geen login in deze omgeving) en draait de live build niet.
Dat gebeurt in Claude Code.

---

### 3. Claude Code (terminal op MacBook of Mac mini) — de bouwer

**Rol:** voert de door Co-work afgewerkte opdracht uit in de repo.

**Sterkte:** leest/bewerkt bestanden direct, draait `npm run build`, commit en
pusht (met goedkeuring per stap), zet sub-agents in.

**Sessie starten:**
```bash
cd ~/veiling-pro
bin/sync.sh pull      # eerst veilig bijwerken naar GitHub
claude
```

---

### De overdrachtsregel (cruciaal tegen contextverlies)

Elke opdracht die Co-work aan Claude Code doorgeeft, opent verplicht met:

> "Lees eerst `MASTER_PROMPT.md`, `DEVELOPER_SETUP.md` en `PROJECT_STATUS.md`.
> De werkwijze daarin geldt onverkort. Frederik is niet-technisch: werk in
> kleine stappen met visuele bevestiging na elke stap. Werk op een
> feature-branch, toon een plan vóór nieuwe features, en doe een build-check
> (`npm run build`) vóór elke commit. Commit/push enkel op vraag, met expliciet
> `git add <pad>`. Daarna: [concrete taak]."

Zo begint Claude Code altijd correct, hoe ruw het oorspronkelijke idee ook was.

---

### Beslisboom — waar begin ik?

1. Ruw idee, onderweg, geen Mac bij de hand? → **Chat** (later naar Co-work)
2. Prompt klaar om te verfijnen met projectcontext? → **Co-work**
3. Opdracht afgewerkt en klaar om te bouwen/committen? → **Claude Code**
4. Twijfel? → begin in **Co-work**; die ziet de repo en kan inschatten of het
   rechtstreeks naar Claude Code kan.

---

## Drie sub-agents in code-omgeving

Ze leven in `~/veiling-pro/.claude/agents/` als markdownbestanden en worden door Claude Code automatisch ingezet op basis van hun `description`-veld.

### `builder` — full-stack feature builder

Bouwt nieuwe features end-to-end (frontend + backend + database als één geheel). Documenteert wijzigingen direct in code-commentaar én update PROJECT_STATUS.md aan eind van elke taak. Draait build-checks vóór elke commit.

**Gebruik voor:** voorbereidingsmodule, live cockpit, live dashboard, timing-module, CRM, historisch archief, alle nieuwe features.

**Niet voor:** data-import van externe sites (→ data-agent), inhoudelijke veilingsteksten (→ content-agent).

---

### `data-agent` — import en databeheer

Beheert alles rond data binnenhalen, structureren en importeren. Verantwoordelijk voor webscraping van veilingsites, JSON-imports, schema-wijzigingen die data raken, datakwaliteit en betrouwbaarheidsmarkeringen.

**Gebruik voor:** importeren van lot-data van veilingsites, historische reconstructies, bulk-updates van bestaande data, schema-migraties.

**Niet voor:** nieuwe features bouwen (→ builder), inhoudelijke teksten (→ content-agent).

---

### `content-agent` — inhoudelijke assistent voor veilingsvoorbereiding

Praat in de taal van een veilingmeester, nooit in jargon. Helpt met het schrijven van USP's per paard, verkooplijnen per type lot, structuur van d-brieven, voorbereiding per veiling. Schrijft geen code.

**Gebruik voor:** USP-templates per type paard, d-brief structuren, verkooplijnen formuleren, voorbereiding Aloga 2026 en toekomstige veilingen.

**Niet voor:** code-werk (→ builder), data-import (→ data-agent).

---

### Hoe de gebruiker de agents gebruikt

Hij praat **alleen met hoofd-Claude in code-omgeving**, niet met sub-agents direct. Hoofd-Claude leest de descriptions en delegeert automatisch. Hij hoeft niets aan te wijzen.

### Bewust geen review-agent als vierde

In plaats van een AI-laag boven de drie sub-agents is gekozen voor **deterministische build-checks** als safeguard. De gebruiker IS de finale review-instantie via visuele tests.

---

## Stack en infrastructuur

- **Frontend:** React (Vite)
- **Backend & database:** Supabase (PostgreSQL + realtime + auth + storage)
- **Deployment:** Vercel
- **Offline (cockpit):** PWA met lokale cache
- **Repository:** https://github.com/frederikdbacker/Veiling-Pro
- **Supabase project:** https://cjxtwzmryrpwoydrqqil.supabase.co

## Deadline

**5 mei 2026** — Aloga Auction 2026. Dit is de harde deadline voor de MVP.
