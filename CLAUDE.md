# CLAUDE.md — wegwijzer (geen duplicaat)

Dit bestand wordt elke Claude Code-sessie automatisch ingeladen. Het
**dupliceert geen werkwijze** — het verwijst naar de echte bron en herhaalt
alleen de paar altijd-geldende regels.

## Enige bron van waarheid

De volledige werkwijze, het gebruikersprofiel en de projectstand staan in,
en worden als één set op dezelfde datum bijgewerkt:

- `MASTER_PROMPT.md` — werkwijze + profiel + sessieprotocol
- `DEVELOPER_SETUP.md` — setup, sync, projectstructuur
- `PROJECT_STATUS.md` — actuele stand + roadmap

**Lees deze drie aan het begin van elke sessie.** Bij tegenspraak met dit
bestand: de drie docs zijn leidend.

## Altijd geldend (samenvatting — details in de drie docs)

1. **Gebruiker is niet-technisch.** Eén stap per keer, wachten op
   bevestiging, visuele bevestiging vragen, geen jargon zonder uitleg.
2. **Geen snelle fix.** Altijd de meest solide, duurzame oplossing, ook als
   dat nu meer werk kost; bij twijfel robuust + kort motiveren.
3. **Diagnose vóór fix**; **volledige bestandsinhoud lezen vóór wijzigen**.
4. **Build-check vóór elke commit** (`npm run build` moet slagen); bij falen
   niet committen, eerst fixen.
5. **Back-up vóór elke schemawijziging**; **plan tonen vóór elke nieuwe
   feature**; **audit-rapport** (gewone taal + `docs/audits/` of `reports/`)
   spontaan aan het eind van elke substantiële sessie.
6. **Multi-Mac sync + commit-discipline:** sessiestart `bin/sync.sh pull`,
   sessie-einde `bin/sync.sh done "tekst"`. Stagen ALTIJD met expliciet
   `git add <pad>` — NOOIT `git add -A`, `git add .`, of `git commit -a`
   (voorkomt dat `.env`, cookies, tijdelijke CSV's per ongeluk in de git-
   history belanden). Altijd via een feature-branch; commits/push enkel
   op vraag; commitberichten in het NL.
7. Schema: live-DB gebruikt `collections`/`collection_id`,
   `lots.lot_type_id` is verplicht (`import-lots.mjs` leidt dat af).
8. **Audit-spoor is onuitwisbaar.** Correctie-rijen (bv.
   `lot_sale_corrections`) worden bij een echte fout **nooit gewist of
   overschreven** — een verkeerde correctie wordt **tegen-geboekt** met een
   nieuwe correctie-rij (oud → nieuw). Enkel zuivere testdata mag opgeruimd
   worden, en dan expliciet als zodanig benoemd.
9. **Sessie-einde-checklist** (bij signaal "afsluiten", "klaar", "tot
   morgen", …): typ de checklist letterlijk in het antwoord uit en vink
   punt voor punt af. Niet "samenvatting + stop" — anders glipt er werk
   tussendoor. Volgorde is bewust: het audit-rapport komt eerst, niet
   laatst.
   1. **Audit-rapport** geschreven naar `reports/<datum>_<thema>.md`.
   2. `PROJECT_STATUS.md` bijgewerkt met header-sectie + audit-link.
   3. `MEMORY.md` + memory-bestanden bijgewerkt waar relevant.
   4. Build-check gedraaid (`npm run build` groen) als frontend geraakt.
   5. Commit-message vooraf getoond, `git add <pad>`, commit-hash genoemd.
   6. Tijdelijke/hulpbestanden in `/tmp/` of werkmap opgeruimd / benoemd.
   7. Openstaande punten expliciet aan Frederik overgedragen.
10. **Werkwijze in drie stappen — Chat → Co-work → Claude Code.** Frederik
    maakt een ruw idee/prompt (Claude Chat), laat die door Co-work verfijnen
    tot een concrete opdracht mét projectcontext, en laat Claude Code die
    uitvoeren. Volledige uitleg in `MASTER_PROMPT.md`, sectie "Drie
    werkomgevingen"; het overdrachtssjabloon staat in `PROMPT_TEMPLATE.md`.
    Elke overdracht naar Claude Code opent met: lees eerst de drie docs,
    feature-branch, plan vóór feature, build-check vóór commit. **Wijs Frederik
    op deze volgorde wanneer hij ervan dreigt af te wijken** — hij hoeft de
    werkwijze niet te onthouden, dat is jouw taak.
