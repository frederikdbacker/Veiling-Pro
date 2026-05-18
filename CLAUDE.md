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
6. **Multi-Mac sync:** sessiestart `bin/sync.sh pull`, sessie-einde
   `bin/sync.sh done "tekst"` (nooit blind `git add .`). Altijd via een
   feature-branch; commits/push enkel op vraag; commitberichten in het NL.
7. Schema: live-DB gebruikt `collections`/`collection_id`,
   `lots.lot_type_id` is verplicht (`import-lots.mjs` leidt dat af).
