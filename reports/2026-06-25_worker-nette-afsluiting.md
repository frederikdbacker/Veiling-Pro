# Scrape-worker sluit voortaan netjes af (geen SIGKILL meer)

**Datum:** 25 juni 2026
**Thema:** Nette, onderbreekbare afsluiting van de scrape-worker op de Mac mini
**Branch:** `fix/worker-nette-afsluiting`
**Geraakt:** `bin/scrape-worker.mjs`, `bin/eu.conceptosaurus.veilingpro.worker.plist.example`,
en de live LaunchAgent op de mini (`~/Library/LaunchAgents/…worker.plist`).
**Schemawijziging:** geen.

## In gewone taal — wat was er aan de hand?

De worker is het programmaatje dat altijd op de Mac mini draait en de
"Collectie ophalen"-opdrachten uitvoert. Elke keer dat hij herstartte (bv. na
een update of automatisch door de Mac), moest het systeem hem **hardhandig
afschieten** in plaats van hem netjes te laten stoppen. Zichtbaar als
exit-status **-9** in de systeemlijst. Het risico was klein — een vangnet
ruimde vastgelopen opdrachten na 20 minuten op — maar de "nette afsluiting" die
we ingebouwd hadden, werkte in de praktijk niet.

## De oorzaak (geverifieerd vóór de fix)

Drie sporen wezen dezelfde kant op:

1. **Code:** de worker controleert elke 60 seconden de wachtrij en sliep daar
   tussenin een volle minuut. Een stopsignaal zette wel een "ik moet stoppen"-
   vlaggetje, maar de worker keek pas ná die 60 seconden. Het systeem wacht
   geen minuut → het schoot hem af.
2. **Instelling (LaunchAgent):** er stond geen `ExitTimeOut`, dus het systeem
   viel terug op zijn standaard (~20s) en stuurde daarna een harde stop.
3. **Logboek:** in `worker.out.log` stond telkens "SIGTERM ontvangen — netjes
   afsluiten…" gevolgd door een herstart, maar **nooit** "worker gestopt."
   ertussen. `worker.err.log` was leeg → geen crash, puur de afsluitroutine.

## Wat is er gewijzigd

In `bin/scrape-worker.mjs`:

1. **Onderbreekbare wachtpauze.** De 60-seconden-pauze in de poll-lus keert nu
   meteen terug zodra er een stopsignaal komt (de signaal-afhandelaar "wekt" de
   lus). Idle stopt de worker daardoor binnen milliseconden.
2. **Eén gecoördineerd, idempotent afsluitpad.** Eén `teardown()` (achter een
   `tornDown`-vlag) en één `finalExit()` (achter een `exited`-vlag) zorgen dat
   het opruimen — hartslag stoppen, realtime-kanaal afmelden, proces afsluiten —
   **precies één keer** gebeurt, of de poll-lus, de vangnet-timer of een tweede
   signaal het nu triggert.
3. **Harde vangnet-timeout.** Lukt de nette afsluiting niet binnen 8 seconden,
   dan sluit de worker **zichzelf** af met code 0 (nooit een harde stop van
   buitenaf). Een tweede stopsignaal sluit meteen af.
4. **Lopende scrape niet halverwege laten hangen.** Wordt er gestopt terwijl er
   een scrape loopt, dan wordt die afgebroken en de opdracht **teruggezet op
   "in wachtrij"** (niet op "mislukt"), zodat de herstarte worker hem vanzelf
   weer oppakt. Belangrijk detail dat tijdens het testen naar boven kwam: dat
   terugzetten wordt nu **afgewacht** vóór het afsluiten — anders kapte het
   afsluiten de database-update af en bleef de opdracht alsnog op "bezig" staan.

In beide LaunchAgent-bestanden: **`ExitTimeOut` = 25 seconden** toegevoegd,
ruim boven de interne 8 seconden, zodat de worker altijd zelf afsluit vóór het
systeem zou ingrijpen. De live plist is herladen (`bootout` + `bootstrap`).

## Hoe het getest is (acceptatie — allemaal groen)

1. **Idle herstart** (`launchctl kickstart -k`): in het logboek verscheen
   "SIGTERM ontvangen…" → "👋 worker gestopt." binnen **6 ms**, gevolgd door een
   nieuwe start. Systeemlijst: exit-status **0** (niet -9). `worker.err.log`
   bleef leeg.
2. **Herstart midden in een lopende scrape** (het risicovolste pad): een
   testopdracht gestart, en ~2,5s later (terwijl hij scrapte) een herstart
   geforceerd. Tijdlijn van de opdracht, live uit de database gevolgd:
   - `running (scrapen)` → na de herstart **`queued` ("onderbroken — opnieuw in
     wachtrij")** — dus níét "mislukt", níét blijvend "bezig";
   - daarna automatisch weer `running` (poging 2) en uiteindelijk **`done` — 21
     lots**. De worker sloot ook hier binnen ~4 ms netjes af, exit-status 0.
3. **Build:** `npm run build` groen (frontend niet geraakt). De worker zelf
   met `node --check` gecontroleerd.

## Opruiming van testdata (transparant benoemd)

De her-imports tijdens test 2 maakten — doordat de scraper een iets andere
veilingnaam teruggaf — een **duplicaat-collectie** "The Collection 2026" (21
lots) aan, naast de bestaande "The Collection Live 2026". Na expliciete
bevestiging van Frederik opgeruimd: duplicaat-collectie + 21 lots + 2
test-opdrachtrijen verwijderd. Vooraf een **backup** (71 KB JSON) gemaakt. De
originele collectie ("The Collection Live 2026", 21 lots, 0 correcties) is
ongewijzigd. Audit-spoor onaangetast (0 correctie-rijen betrokken).

## Restpunten / aandachtspunten

- **De-importer is niet volledig idempotent voor `mode=create`:** dezelfde
  veiling opnieuw ophalen kan een tweede collectie maken als de gescrapete
  veilingnaam licht verschilt. Buiten scope van deze taak, maar het verklaart de
  duplicaat hierboven en is het overwegen waard (dedupe op `source_url` i.p.v.
  enkel op naam).
- Een afgebroken Puppeteer-scrape kan kortstondig een Chromium-proces wezen
  laten; dat lost vanzelf op en is onschadelijk.
