# Veiling Pro — Stap 1: inventaris vóór het doorgeefluik

**Datum meting:** 13 augustus 2026, 11:03–11:10 UTC
**Project:** cjxtwzmryrpwoydrqqil (eu-west-1)
**Rol in dit traject:** auditer. Er is deze sessie **niets gewijzigd** — alleen gelezen.
**Status Weg B:** stap 1 afgerond. Stap 2 (bouwen) kan starten.

> **Aanvulling 11:17 UTC — zie sectie 11.** Frederik heeft de app geopend. De
> openstaande controle uit sectie 7 is daarmee geslaagd: het meetinstrument
> werkt, en de nul in de eerdere vensters is een echte nul. Sectie 7 blijft
> hieronder staan zoals geschreven; sectie 11 corrigeert hem. Die meting
> leverde bovendien twee bouwrisico's op die ik zonder die klik niet had gezien.

---

## 1. Wat er in gewone taal aan de hand is

De database staat wagenwijd open voor iedereen die de publieke sleutel uit de
browser plukt. Dat is bevestigd, niet afgeleid: ik heb mezelf tijdelijk de rol
van een buitenstaander aangemeten en toen alle 98 klanten en alle 11.806 loten
gewoon kunnen lezen.

Twee dingen die de briefing niet had en die het beeld bijstellen:

**Minder erg dan gevreesd.** De klantgegevens zijn grotendeels leeg. Nul
contactgegevens ingevuld, nul foto's, nul notities. Wat er wél ligt: 98 namen
met land, en 122 koppelingen tussen klant en lot — dat laatste is de
handelsinformatie die pijn doet (wie zit achter welk paard aan), plus 5 vrije
notities daarbij. Geen persoonsgegevenslek van betekenis, wel een
concurrentiegevoelig lek.

**Ingewikkelder dan gedacht.** De app heeft wél een inlog, alleen niet in dit
project. Gebruikers en rollen leven in een tweede Supabase-project
(`igunbmpreaqrlyqnxeud`, "centrale login"). Elke ingelogde gebruiker praat met
de veilingdatabase alsnog als anonieme bezoeker, want dit project herkent het
inlogbewijs van dat andere project niet. Dat is goed nieuws voor stap 2: het
autorisatiepunt dat het doorgeefluik nodig heeft, bestaat al.

---

## 2. Wat ik hermeten heb — en of het klopte

| Bewering uit de briefing | Uitkomst hermeting |
|---|---|
| 21 tabellen in public, alle 21 RLS aan | **Klopt** |
| 20 daarvan met precies 1 policy | **Klopt** |
| Alle 20 identiek: rol `{public}`, cmd `ALL`, qual `true`, with_check `true` | **Klopt**, alle 20 letterlijk identiek |
| `collection_spotters_backup_0038`: RLS aan, geen policy | **Klopt** |
| `auth.users` telt nul rijen | **Klopt** — ook 0 identities, 0 sessies, 0 tokens |
| 4.242 edge_logs over 24 uur, alleen twee worker-endpoints, user-agent node | **Klopt**, in vier vensters op rij |

De 4.242 uit de briefing is exact het getal van het venster 6→7 augustus. Mijn
eigen vensters geven 4.250 (12→13 aug), 4.151 (11→12 aug) en 4.303 (9→10 aug).
Zelfde patroon, andere dag.

---

## 3. Wat de briefing niet had

### 3.1 De policies staan op `public`, niet op `anon`

Er staat `{public}` in de rolkolom. `public` is in Postgres niet "de anonieme
bezoeker" maar **elke rol die bestaat of ooit zal bestaan**. Zodra er echte
inlog op dit project komt, erft die rol dezelfde alles-mag-policy. Wie in stap 5
de policies versmalt en daarbij alleen aan `anon` denkt, laat het gat open.

### 3.2 De rechten staan náást de policies open

Elke rol — `anon`, `authenticated`, `service_role` — heeft op alle 21 tabellen
volledige rechten: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES,
TRIGGER. Dat staat los van RLS. `collection_spotters_backup_0038` bewijst het:
die tabel heeft dezelfde volledige rechten voor `anon`, en is toch dicht — puur
omdat RLS zonder policy alles tegenhoudt. RLS is dus het énige slot op de deur.

Gevolg voor stap 5: policies versmallen is niet genoeg. De rechten moeten mee
ingetrokken, anders hangt de hele beveiliging aan één mechanisme.

*Nuance, want ik wil niet dramatiseren:* TRUNCATE is via de REST-API niet
aanroepbaar en `anon` kan niet rechtstreeks op de database inloggen. Dit is dus
geen acuut gat, wel een tweede slot dat ontbreekt.

### 3.3 De worker gebruikt dezelfde publieke sleutel als de browser

Alle 4.250 aanroepen in het venster 12→13 augustus dragen een sleutel van het
type *publishable* — niet *secret*. De achtergrondworker (`bin/scrape-worker.mjs`)
draait dus op exact dezelfde sleutel die in de browserbundel staat.

Gevolg voor stap 4: de rotatie legt de worker plat als die niet tegelijk wordt
omgezet. De worker moet in stap 2 mee naar de servicesleutel, vóór de rotatie.

### 3.4 Storage-bucket `client-photos` staat publiek

Publiek leesbaar, geen enkele policy op `storage.objects`. Een doorgeefluik lost
dit **niet** op — een publieke bucket is leesbaar zonder welke sleutel dan ook.

*Maar:* de bucket is leeg. Nul objecten, en nul klanten met een foto-URL. Het is
dus een openstaande deur naar een lege kamer. Dichtzetten kan losstaand en met
weinig risico; het hoeft stap 2 niet op te houden.

### 3.5 De beveiligingsadviseur bevestigt zijn eigen blinde vlek

De adviseur van Supabase geeft precies één melding, op INFO-niveau, over
`collection_spotters_backup_0038`. Over de twintig alles-open policies zwijgt
hij. De enige tabel die de adviseur aanwijst, is de enige tabel die dícht zit.

### 3.6 Gat in `.gitignore` — dezelfde vorm als het FEI-incident

`.gitignore` dekt `.env`, `.env.local` en `.env.*.local`. Niet gedekt:
`.env.production`, `.env.backup`, `.env.old`, `.env.bak`. Dat is exact de vorm
van het lek dat op 6 augustus in het FEI-project twee sleutelbestanden naar
GitHub bracht. Op dit moment is er niets gelekt — `.env.local` staat nergens in
de git-historie, en het enige sleutelbestand in de historie is `.env.example`
met sjabloonwaarden. Aanbeveling voor stap 2: vervang de drie regels door
`.env*` plus `!.env.example`.

---

## 4. Eén meting die ik verkeerd las — en dus meld

Bij het uittellen van de code kwam `VITE_SUPABASE_SERVICE_ROLE_KEY` boven
water. Alles met `VITE_` ervoor wordt door de bouwstap in de browserbundel
gebakken. Als dat de servicesleutel is, is dat veel erger dan alles hierboven.

Nagemeten: **vals alarm.** De naam staat op precies één plek
(`scripts/fix-zangersheide-foals.mjs`, regel 7) als reservewaarde in een
node-script dat nooit in de browser komt. De variabele staat niet in
`.env.local`. In de gebouwde bundel: nul treffers op `sb_secret_`, nul op
`service_role`, wel de publishable sleutel — precies wat er hoort te staan.

Ik noteer dit omdat een audit die alleen zijn treffers rapporteert, niet
narekenbaar is.

---

## 5. Het bewijs dat de deur openstaat — tweezijdig

Ik heb binnen een teruggedraaide transactie de rol `anon` aangenomen en geteld:

| Tabel | Zichtbaar als `anon` | Werkelijk aantal | Oordeel |
|---|---|---|---|
| clients | 98 | 98 | volledig open |
| entity_profiles | 133 | 133 | volledig open |
| lot_interested_clients | 122 | 122 | volledig open |
| client_collection_seating | 88 | 88 | volledig open |
| lots | 11.806 | 11.806 | volledig open |
| **collection_spotters_backup_0038** | **0** | **17** | **dicht — controlegroep** |

De laatste regel is de reden dat de andere regels iets betekenen. Dezelfde
toets, dezelfde transactie, één tabel die nul teruggeeft. De toets werkt dus; de
98 en de 11.806 zijn geen meetfout.

---

## 6. Waar wordt welke tabel gebruikt

De 18 tabellen met nul logverkeer zijn níét ongebruikt — ze zijn niet
aangeroepen in het gemeten venster omdat er in dat venster geen browser aan
stond. De code vertelt het echte verhaal:

**Browsercode (`src/`) — 18 tabellen, 155 aanroepen**

| Tabel | Aanroepen | | Tabel | Aanroepen |
|---|---|---|---|---|
| lots | 45 | | collection_breaks | 6 |
| collections | 19 | | client_collection_seating | 6 |
| collection_spotters | 16 | | spotters | 4 |
| collection_days | 8 | | scrape_jobs | 4 |
| lot_interested_clients | 7 | | house_committee_members | 4 |
| collection_lot_types | 7 | | lot_types | 3 |
| clients | 7 | | lot_sale_corrections | 2 |
| bid_step_rules | 7 | | worker_heartbeat | 1 |
| auction_houses | 7 | | *user_roles* | *1 (ander project)* |

**Servercode (`scripts/`, `bin/`) — 8 tabellen, 67 aanroepen:** collections (17),
lots (15), auction_houses (13), house_committee_members (9), scrape_jobs (4),
lot_types (4), collection_days (4), worker_heartbeat (1).

Twee gevolgen voor het luik:

1. **Alle 20 tabellen moeten erdoor.** Geen enkele is ongebruikt. `entity_aliases`
   en `entity_profiles` komen niet in deze telling voor omdat ze via losse
   import-scripts lopen — die moeten apart nagelopen, ze staan wél vol data (134
   en 133 rijen).
2. **Het luik hoeft alleen tabel-endpoints te dekken.** Nul views, nul
   database-functies, nul RPC-aanroepen in het hele project. Dat maakt het luik
   een stuk eenvoudiger: alleen `/rest/v1/<tabel>` doorsturen, geen `/rpc/`.

---

## 7. De zwakke plek in mijn eigen meting *(achterhaald — zie sectie 11)*

**Ik heb geen positieve controle op het logverkeer.** Vier vensters lang is
100% van het verkeer `node` met status 200 — geen enkele browseraanroep, geen
enkele 4xx. Dat is consistent met "er heeft niemand de app opengehad", maar ik
kan het niet onderscheiden van "browserverkeer verschijnt om een andere reden
niet in dit logkanaal". Mijn poging tot controle (een aanroep zonder sleutel,
die een 401 had moeten loggen) kwam niet aan bij Supabase en leverde ook geen
logregel op — dus die controle telt niet.

**Wat dit oplost, kost één minuut:** open de app in je browser, klik één
veilinglijst open, en laat het me weten. Ik meet dan direct het venster erna. Zie
ik jouw klik terug in de logs, dan is de nul een echte nul en weet ik dat het
logkanaal browserverkeer vangt. Zie ik hem niet, dan is het meetinstrument stuk
en is elke conclusie over "geen browserverkeer" waardeloos.

Tot dat moment: de bewering "er is geen browserverkeer" heeft de status
**onbevestigd**. Het bouwen van het luik hangt er niet van af — de code-telling
in sectie 6 is de harde grond onder stap 2, niet de logs.

---

## 8. `collection_spotters_backup_0038` — advies: laten staan, later opruimen

- 17 rijen, aangemaakt door migratie `0038_collection_spotters_per_day.sql` als
  vangnet bij de omzetting naar spotters-per-dag.
- **Nul verwijzingen in code.** Komt alleen voor in `PROJECT_STATUS.md`, in de
  migratie zelf en in het rapport van 30 juni — dat toen al om een sein vroeg om
  hem op te ruimen.
- Hij is voor de app onbereikbaar en dat breekt niets, want niets roept hem aan.

Wegdoen is een destructieve wijziging en vraagt dus backup + jouw expliciete
bevestiging. Bovendien geldt: niets wijzigen tot stap 3 geslaagd is. **Advies:
opruimen ná de sleutelrotatie**, als aparte handeling — dan is hij ruim zes
weken ongebruikt gebleken en is het vangnet zijn functie voorbij.

---

## 9. Wat stap 2 moet worden

Concrete bouwopdracht, af te leiden uit bovenstaande metingen:

1. **Server-side doorgeefluik**, patroon `control-center/app/api/backend/[...path]`
   uit het FEI-project. Dekt `/rest/v1/<tabel>` voor 20 tabellen; geen `/rpc/`
   nodig (sectie 6).
2. **Het luik draait op de servicesleutel**, server-side, nooit in de browser.
3. **Autorisatie via de centrale login** die er al is: het luik valideert het
   inlogbewijs van `igunbmpreaqrlyqnxeud` en kijkt de rol na in `user_roles`
   (sectie 1). Zonder geldig bewijs: weigeren.
4. **De worker gaat mee** naar de servicesleutel of naar het luik — anders valt
   hij om bij de rotatie (sectie 3.3).
5. **`.gitignore` verbreden** naar `.env*` plus `!.env.example` (sectie 3.6).
6. **Nog niet roteren, nog geen policy aanraken.** Stap 3 eerst: aantonen dat de
   app volledig werkt via het luik terwijl de oude sleutel nog geldig is.

Acceptatie van stap 3 is tweezijdig en moet dat expliciet zijn: (a) elk scherm
werkt via het luik, (b) — pas ná de rotatie in stap 4 — een rechtstreekse
aanroep met de oude sleutel wordt geweigerd. De oude sleutelwaarde bewaren tot
je hem hebt zien falen; buiten de werkmap, en niet in een bestand in deze repo.

---

## 10. Herkomst van elk getal

Alle metingen op 13 augustus 2026. Elke bewering hierboven komt uit één van deze:

| # | Wat | Bron | Tijdstip (UTC) |
|---|---|---|---|
| Q1 | 21 tabellen, RLS-vlag, aantal policies | `pg_class` + `pg_policy`, schema public | 11:03:41 |
| Q2 | Volledige inhoud 20 policies (rol/cmd/qual/with_check) | `pg_policies` where schemaname='public' | 11:03:56 |
| Q3 | auth.users=0, identities=0, sessions=0, tokens=0 | `auth.users` / `auth.identities` / `auth.sessions` / `auth.refresh_tokens` | 11:04:00 |
| Q4 | Rechten per rol per tabel | `information_schema.role_table_grants` | 11:04:19 |
| Q5 | 0 views, 0 functies, bucket client-photos public=true | `pg_class` (relkind v/m), `pg_proc`, `storage.buckets` | 11:04:45 |
| Q6 | Rijaantallen alle 21 tabellen | count(*) per tabel | 11:04:51 |
| Q7 | **Tweezijdige toets als `anon`** (sectie 5) | `begin; set local role anon; …; rollback;` | 11:05:26 |
| Q8 | Kolomnamen clients / entity_profiles / seating / interested | `information_schema.columns` | ±11:05 |
| Q9 | Verkeer 12→13 aug: 4.250 edge, 577 postgres, 568 postgrest | `logs` group by source | 11:06 |
| Q10 | Pad/methode/user-agent/sleutelhash/status per aanroep | `edge_logs` group by, venster 12-08 11:00 → 13-08 11:00 | 11:06 |
| Q11 | Zelfde patroon venster 11→12 aug (4.151) | idem, ander venster | 11:07 |
| Q12 | Zelfde patroon venster 9→10 aug (4.303) | idem | 11:07 |
| Q13 | Venster 6→7 aug: 4.242, 100% node, 100% status 200 | idem | 11:08 |
| Q14 | Sleutelsoort = publishable op beide worker-endpoints | `edge_logs`, prefix-classificatie | 11:08 |
| Q15 | Tabelaanroepen in `src/` (155) en `scripts/`+`bin/` (67) | grep op `.from('<tabel>')` | 11:07 |
| Q16 | `.gitignore`-inhoud; `.env.local` nooit gecommit | `git log --all -- .env.local`, leeg resultaat | 11:07 |
| Q17 | Servicesleutel niet in de bundel (sectie 4) | grep `sb_secret_` / `service_role` in `dist/` → 0 | 11:09 |
| Q18 | Storage leeg, clients zonder contact/foto/notitie | count(*) storage.objects + clients-kolommen | 11:09:39 |
| Q19 | Adviseur meldt alleen backup_0038 (INFO) | Supabase security advisors | 11:09 |
| Q20 | backup_0038 nergens in code aangeroepen | grep hele repo buiten node_modules | 11:08 |
| Q21 | **Geslaagde** positieve controle browserverkeer (sectie 11) | `edge_logs`, filter user-agent `Mozilla%` | 11:20 |
| Q22 | URL-lengte per browseraanroep, langste 10.838 bytes | `length(request.url)` op dezelfde regels | 11:21 |

---

## 11. Aanvulling 11:17 UTC — de controle is geslaagd, en mijn sectie 7 was fout

Frederik opende `veiling-pro.vercel.app/collections/828aa101-…` om 11:17:23.

### 11.1 Het instrument werkt

Achttien aanroepen verschenen in `edge_logs` tussen 11:17:23 en 11:17:29, met
user-agent Chrome/150 en `x_client_info: supabase-js-web/2.105.1`, elk met de
publishable sleutel en status 200.

**De nul in de vier eerdere vensters is dus een echte nul.** Er wás geen
browserverkeer; het logkanaal vangt het wel degelijk.

### 11.2 Mijn controle was niet mislukt — ik keek te vroeg

In dezelfde uitdraai staat ook mijn eigen controle-aanroep van 11:07:08:
`GET /rest/v1/clients?limit=1&select=id`, geen sleutel, **status 401**.

Die was er dus wél. Mijn controlequery draaide rond 11:06 en zocht in een venster
dat op dat moment nog niet bestond. Ik concludeerde "instrument onbetrouwbaar"
terwijl het instrument goed was en mijn tijdstip fout.

Dat is de regel "verdenk eerst het instrument" verkeerd om toegepast: ik
verdacht het instrument in plaats van mijn eigen meetmoment. Genoteerd, want
sectie 7 stond op het punt een verkeerde conclusie in het traject te schuiven.

Die 401 heeft bovendien zelfstandige waarde: hij bevestigt dat de sleutel wél
vereist is. "De database staat open voor iedereen" betekent dus precies
"iedereen die de publishable sleutel uit de browserbundel plukt" — niet
"iedereen met de URL".

### 11.3 Twee bouwrisico's die alleen deze klik kon tonen

**(a) Eén URL van 10.838 bytes.**

Bij het openen van de collectie stuurt de app dit:

```
GET /rest/v1/collection_days?select=collection_id,date&collection_id=in.(… ±250 UUID's …)
```

De volledige URL is **10.838 bytes** — gemeten, niet geschat. Alle andere
aanroepen blijven onder 400 bytes.

Dit is een breekpunt voor het doorgeefluik. Serverloze platforms hanteren een
maximum voor URL plus headers in de orde van 14–16 kB; met 10,8 kB zit deze
aanroep daar nu net onder, en hij **groeit mee met het aantal collecties per
veilinghuis** (nu 323 collecties over 17 huizen). Een luik voegt een extra hop
toe die zijn eigen limiet meebrengt.

*Advies:* dit niet in het luik opvangen maar bij de bron oplossen — de app moet
`collection_days` filteren op `house_id` in plaats van op een opgesomde lijst
van alle collectie-id's. Dat maakt de URL constant van lengte. Los van het luik
is dit sowieso een tijdbom.

**(b) CORS-preflights zonder sleutel.**

Van de 18 aanroepen zijn er 8 `OPTIONS`-verzoeken die de browser vooraf stuurt,
zónder sleutel. Het luik moet die zelf beantwoorden; stuurt het ze door of
weigert het ze wegens ontbrekende sleutel, dan blokkeert de browser elke
daaropvolgende aanroep en lijkt de app stuk zonder zichtbare foutmelding.

### 11.4 Wat één schermopening werkelijk aanraakt

Elf tabellen in zes seconden: `auction_houses`, `collections`, `lots`,
`collection_days`, `collection_breaks`, `collection_lot_types`, `lot_types`,
`bid_step_rules`, `house_committee_members`, `scrape_jobs`, `worker_heartbeat`.

Twee daarvan gebruiken PostgREST-koppelingen die de querystring in het pad
meedragen:

```
collections?select=*,auction_houses(id,name)
lots?select=…,collections!lots_auction_id_fkey!inner(name,date,house_id)
```

*Gevolg voor het ontwerp:* het luik moet **dom** zijn — pad en querystring
één-op-één doorsturen naar PostgREST. Een luik met een handgeschreven endpoint
per tabel gaat deze koppelingen stukmaken, en dat merk je pas scherm voor
scherm. Autoriseren op tabelnaam en methode; de querystring niet aanraken.
