# MASTER_PROMPT — Veiling-Pro

**Aangemaakt: april 2026 — laatste update: 6 mei 2026 (Fase 0 iteratie)**
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

---

## Twee werkomgevingen — chat en code

### Chat (claude.ai — deze interface)

**Wat het is:** een gewoon gesprek. Geen terminal nodig.

**Wat het kan:**
- Plannen maken, blauwdrukken schrijven, documenten bijwerken
- Korte vragen of uitleg
- Werken vanaf iPad of smartphone

**Wat het NIET kan:**
- Bestanden in de repo zelf lezen of bewerken
- Code direct draaien
- Database queries uitvoeren
- Sub-agents inzetten

In chat schrijft Claude **patch-scripts** wanneer code nodig is. Hij downloadt het script en draait het via de terminal.

---

### Code (Claude Code — terminal op MacBook)

**Wat het is:** een commandotool die je start in de terminal vanuit de projectmap. Claude leest dan direct de bestanden in de repo en kan ze direct bewerken.

**Wat het kan:**
- Direct bestanden lezen en bewerken in `~/veiling-pro/`
- Tests draaien (npm build)
- Git commit en push (met goedkeuring per stap)
- Multi-file refactors in één opdracht
- **Sub-agents inzetten**
- **Build-checks uitvoeren vóór commit**

**Sessie starten:**
```bash
cd ~/veiling-pro
claude
```

**Eerste opdracht in elke nieuwe code-sessie altijd:**
> "Lees PROJECT_STATUS.md, MASTER_PROMPT.md en DEVELOPER_SETUP.md voor context. Werkwijze uit deze documenten geldt onverkort. De gebruiker is niet-technisch, dus klein-stappen-werkwijze met visuele bevestiging na elke stap. Daarna: [concrete taak]."

---

### Beslisboom — bij elke nieuwe sessie

1. Is dit een ontwerp-/brainstorm-/documentvraag? → **chat**
2. Heb ik geen MacBook bij de hand? → **chat**
3. Gaat het om concrete code-wijzigingen in de repo? → **code**
4. Gaat het om bug-onderzoek met logs of database? → **code**
5. Twijfel? → begin in chat, schakel naar code zodra Claude een tweede patch-script wil schrijven

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
