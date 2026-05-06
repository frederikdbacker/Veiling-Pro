# SESSION_OPENER_FASE_0 — Claude Code-startprompt

**Bedoeld voor: eerste Claude Code-sessie ná Aloga Auction 2026**
**Aangemaakt: 5 mei 2026**

---

## Hoe te gebruiken

1. Bewaar dit bestand in iCloud Drive in dezelfde map als
   `POST_ALOGA_ROADMAP.md`, naast de andere projectdocumenten
2. Open Terminal en navigeer naar de projectmap (nieuw iCloud-pad — wordt
   bevestigd als eerste actie van de sessie)
3. Start Claude Code met `claude`
4. Plak de prompt hieronder als allereerste bericht
5. Volg klein-stappen-werkwijze, bevestig elke stap visueel

---

## De prompt — kopieer alles tussen de strepen

────────────────────────────────────────────────────────────

Lees in deze volgorde de volgende bestanden voor context:

1. PROJECT_STATUS.md — huidige stand van het project
2. MASTER_PROMPT.md — werkwijze en gebruikersprofiel
3. DEVELOPER_SETUP.md — technische setup
4. HANDOVER.md — overdracht-notities (gedateerd 30 april)
5. POST_ALOGA_ROADMAP.md — roadmap voor deze iteratie (27 items, 7 fases)

De werkwijze uit deze documenten geldt onverkort. Belangrijkste regels:
de gebruiker is niet-technisch, dus klein-stappen-werkwijze met visuele
bevestiging na elke stap. Plan-mode verplicht voor elke nieuwe feature.
Audit-rapport aan eind van elke sessie. Database-backup vóór elke migratie.

We starten Fase 0 uit de roadmap: iCloud-setup. Tussen 30 april en nu is
de projectmap verhuisd naar iCloud Drive — dat moet schoon afgehandeld
worden vóór we aan features beginnen.

Concreet voor deze sessie, in volgorde:

STAP 1 — Pad bevestigen
Voer `pwd` uit en toon het exacte huidige pad. Bevestig dat dit binnen
iCloud Drive zit. Toon dit aan de gebruiker.

STAP 2 — node_modules-aanpak voorstellen
Inventariseer of `node_modules` momenteel mee-syncet met iCloud (kijk of
er .icloud-stub-bestanden zijn, of de map raar groot is, of er sync-
indicatoren staan). Doe een onderbouwd voorstel voor de aanpak — bv.
hernoemen naar node_modules.nosync en symlink, of een andere methode.
Wacht op goedkeuring vóór je iets doet.

STAP 3 — Build-check
Voer `npm run build` uit. Moet slagen zonder errors. Indien fouten:
diagnose vóór fix, geen aannames.

STAP 4 — Dev-server-check
Start `npm run dev` in een aparte terminal en vraag de gebruiker visueel
te bevestigen dat de app vlot opent op http://localhost:5173 zonder
merkbare iCloud-vertraging.

STAP 5 — Documentatie bijwerken
Werk de volgende documenten bij — lees eerst de huidige inhoud volledig
voor je iets wijzigt:

- HANDOVER.md gotcha #6 ("iCloud-sync of niet?") — herschrijven naar de
  nieuwe situatie. Project staat nu in iCloud; sync tussen Macs verloopt
  daarlangs. Beschrijf de drie valkuilen (node_modules-sync, .git-
  conflicten, file-watching tijdens npm run dev) zoals geformuleerd in
  POST_ALOGA_ROADMAP.md.
- DEVELOPER_SETUP.md — controleer alle padverwijzingen en pas aan waar
  het oude pad ~/veiling-pro nog vermeld staat. Voeg een sectie toe over
  iCloud-overwegingen indien nuttig.
- MASTER_PROMPT.md — controleer of er padverwijzingen staan en pas die
  aan waar nodig.
- PROJECT_STATUS.md — voeg een korte notitie toe dat de iteratie volgens
  POST_ALOGA_ROADMAP.md is gestart, met de datum.

Voor elk gewijzigd document: toon de diff, vraag bevestiging vóór je opslaat.

STAP 6 — Audit-rapport
Schrijf een audit-rapport in reports/[datum]_fase-0-icloud-setup.md met:
- Wat is er gewijzigd
- Wat zou er fout kunnen gaan
- Wat moet visueel gecontroleerd worden
- Hoe rollback indien nodig

STAP 7 — Commit en push
Build-check uitvoeren. Bij groen: commit met duidelijke boodschap
("Fase 0: iCloud-setup en documentatie-update") en push naar main.
Verifieer dat Vercel-deployment slaagt.

STAP 8 — Volgende stap
Vraag of we doorgaan naar Fase 1 (quick wins: items 3, 9, 4, 10b, 16
volgens de roadmap) of dat de gebruiker eerst iets anders wil aanpakken.

Belangrijke aandachtspunten:
- Open issue uit de roadmap: spotter-toevoegen geeft een foutmelding
  (items 19+20). De gebruiker zou de exacte foutmelding nog doorgeven —
  vraag er expliciet naar wanneer Fase 0 is afgerond, want dit kan een
  prioriteit krijgen vóór Fase 1.
- Pre-fase checks uit de roadmap (Supabase-kolommen) — vraag of de
  gebruiker die heeft kunnen doen tussen 5 mei en nu. Indien niet:
  aanbieden om ze samen te doen vóór Fase 1.

Begin met STAP 1.

────────────────────────────────────────────────────────────

## Voor latere sessies

Wanneer Fase 0 afgerond is en je een nieuwe Claude Code-sessie start voor
Fase 1, gebruik dan een verkorte versie van bovenstaande prompt:

> Lees PROJECT_STATUS.md, MASTER_PROMPT.md, DEVELOPER_SETUP.md, HANDOVER.md
> en POST_ALOGA_ROADMAP.md voor context. Werkwijze geldt onverkort, klein-
> stappen, plan-mode, audit-rapport.
>
> We starten Fase [N] uit de roadmap. [Eventueel: status van openstaande
> items uit vorige sessie. Eventueel: status spotter-foutmelding.]
>
> Begin met plan-mode voor [eerste item van de fase].

Vervang `[N]` door het fase-nummer en pas de eerste item aan.
