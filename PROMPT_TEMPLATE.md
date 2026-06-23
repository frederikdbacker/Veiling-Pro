# PROMPT_TEMPLATE — overdracht van Co-work naar Claude Code

Dit is het vaste sjabloon voor stap 3 van de werkwijze (zie `MASTER_PROMPT.md`,
sectie "Drie werkomgevingen"). **Co-work vult dit in** op basis van de ruwe
prompt van Frederik plus de echte projectcontext, en levert het als één blok
dat Frederik letterlijk in Claude Code plakt. Doel: elke overdracht heeft
dezelfde vorm en er gaat geen context verloren.

---

## Vaste opening — altijd letterlijk meekopiëren

> Lees eerst `MASTER_PROMPT.md`, `DEVELOPER_SETUP.md` en `PROJECT_STATUS.md`.
> De werkwijze daarin geldt onverkort. Frederik is niet-technisch: werk in
> kleine stappen met visuele bevestiging na elke stap. Werk op een
> feature-branch, toon een plan vóór nieuwe features, en doe een build-check
> (`npm run build`) vóór elke commit. Commit/push enkel op vraag, met expliciet
> `git add <pad>` (nooit `git add -A`/`.`). Daarna: zie opdracht hieronder.

---

## Opdracht (door Co-work ingevuld)

**1. Doel (één zin)**
_Wat moet er na deze taak waar zijn?_

**2. Achtergrond / waarom**
_Welk probleem of welke wens ligt eronder?_

**3. Concrete taak**
_Wat moet Claude Code precies doen?_

**4. Geraakte plekken — met échte namen (Co-work vult in vanuit de repo)**
- Bestanden / componenten: …
- Schema / tabellen: …
- Bestaande patronen om te volgen: …

**5. Klaar wanneer (acceptatie)**
_Hoe kan Frederik visueel of functioneel controleren dat het werkt?_

**6. Let op / risico's**
_Audit-spoor onuitwisbaar, schema-gevoeligheden, back-up vóór migratie,
deadline-impact, enz._

---

## Na afloop (herinnering voor Claude Code)

- Build-check groen vóór commit.
- Audit-rapport in `reports/<datum>_<thema>.md` bij een substantiële sessie.
- De drie docs (`MASTER_PROMPT`, `DEVELOPER_SETUP`, `PROJECT_STATUS`) als één
  set op dezelfde datum bijwerken.
