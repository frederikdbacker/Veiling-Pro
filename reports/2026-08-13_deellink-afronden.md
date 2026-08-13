# Veilige deellink afgerond — migratie 0039 toegepast en getest

**Datum:** 13 augustus 2026
**Branch:** `feat/veilige-deellink`
**Project:** cjxtwzmryrpwoydrqqil (data-project)
**Voortgekomen uit:** `reports/2026-08-13_rls-inventaris-stap1.md`
**Vorig rapport over deze functie:** `reports/2026-07-04_veilige-deellink.md`

---

## ⚠️ Lees dit eerst — de deellink is nog NIET veilig om te versturen

Migratie 0039 zet op de nieuwe tabel `collection_shares` **dezelfde
wagenwijd-open regel** als op de twintig andere tabellen: iedereen mag alles
lezen en schrijven. Dat is bewust — anders kan het beheerscherm van Frederik de
links niet beheren, want het data-project kent nog geen echte inlog.

**Gevolg:** iedereen die de publieke sleutel uit de browser plukt, kan de tabel
`collection_shares` uitlezen en dus **alle tokens gewoon opvragen**. Een token
van 192 bits hoeft niet geraden te worden als je het kunt ophalen.

> **Stuur nog geen deellink naar een buitenstaander** tot het server-side
> doorgeefluik uit stap 2 van het RLS-traject live staat. Voor eigen gebruik en
> voor testen is de link prima.

Er is bewust **geen tussenoplossing** gebouwd; die zou bij het doorgeefluik
meteen weer weggegooid worden.

---

## 1. Wat er in gewone taal gebeurd is

De functie "deel het eindoverzicht met de organisatie" was in juli helemaal
uitgeschreven in code, maar het database-deel is er nooit gekomen. De code riep
een tabel en een functie aan die niet bestonden. **De knop kon dus nooit gewerkt
hebben** — dat is gemeten, niet vermoed (zie §2).

Deze sessie: het ontbrekende database-deel toegepast, en daarna alle vier de
gevallen aangetoond — de link die wél werkt, en de drie die netjes moeten
weigeren.

---

## 2. Uitgangstoestand, gemeten vóór er iets veranderde

| Meting | Uitkomst |
|---|---|
| Tabel `collection_shares` aanwezig | **0** — bestond niet |
| Functie `get_shared_collection_summary` aanwezig | **0** |
| Functies in schema `public`, totaal | **0** — nul, in het hele project |
| Tabellen in schema `public` | 21 |
| Open policies (`ALL`, `using(true)`, rol `public`) | 20 |
| Commits op `feat/veilige-deellink` vóór `main` | **0** (ook op `origin/`) |
| Commits op `feat/centrale-login` vóór `main` | **0** |

**De belangrijkste vondst zit in de laatste twee regels.** Niet alleen de
deellink stond ongecommit — de centrale login van 2 juli, die in
`PROJECT_STATUS.md` als "gebouwd en getest" beschreven staat, was óók nooit
vastgelegd. Twee functies bestonden uitsluitend als losse, niet-opgeslagen
bestanden op één Mac. Eén `git checkout .` of één kapotte schijf en beide waren
weg geweest. De takken bestonden wel als naam, maar waren leeg.

---

## 3. Wat er in de werkmap stond (inventaris)

**Gewijzigd — 8 bestanden**

| Bestand | Wijziging |
|---|---|
| `src/main.jsx` | Router boven de login-poort, zodat de publieke route erbuiten valt |
| `src/App.jsx` | Nieuwe publieke route `/gedeeld/:token`; interne routes in `AuthLayout` |
| `src/pages/CollectionPage.jsx` | "Link kopiëren" levert nu een token-link; nieuwe knop "🔒 Deellinks" |
| `src/pages/CollectionSummaryPage.jsx` | 417 regels reken-/toonlogica verhuisd naar gedeelde bestanden |
| `.env.example` | Twee sjabloonregels voor de centrale login |
| `DEVELOPER_SETUP.md` | Uitleg over de twee login-variabelen |
| `PROJECT_STATUS.md` | Alleen het blok van 2 juli; over de deellink stond er niets |
| `.claude/settings.json` | Twee toegestane hulpmiddelen erbij (los van deze functie) |

**Nieuw — 11 codebestanden + 2 migraties**

- Login (2 juli): `AuthContext.jsx`, `centralAuth.js`, `AuthGate.jsx`,
  `LoginScreen.jsx`, `AccountBar.jsx`
- Deellink (4 juli): `AuthLayout.jsx`, `shares.js`, `ShareLinksModal.jsx`,
  `SharedSummaryPage.jsx`, `SummaryView.jsx`, `summaryStats.js`
- `supabase/migrations/0039_collection_shares.sql` — toegepast deze sessie
- `supabase/migrations/0040_lockdown_anon_reads.PROPOSAL.sql` — **niet
  aangeraakt**, zie §7

**Vastgesteld ontbrekend:** uitsluitend het database-deel. De code is compleet
en samenhangend. Alle 30 kolomnamen die 0039 aanroept, zijn vóór het toepassen
één voor één nagemeten tegen de echte database — alle 30 bestaan.

---

## 4. Migratie 0039 — wat hij doet

Volledig additief en idempotent (`create table if not exists`, `create or
replace function`, `drop policy if exists` → `create policy`). Geen bestaande
tabel, kolom of policy geraakt. Daarom zonder aparte backup toegepast, conform
de migratieregel in `MASTER_PROMPT.md` §7.

1. **Tabel `collection_shares`** — per gedeelde collectie een lang, willekeurig
   token, met optionele omschrijving, vervaldatum en intrek-moment.
2. **Open policy** — hetzelfde patroon als de rest van het schema. Zie de
   waarschuwing bovenaan.
3. **Functie `get_shared_collection_summary(token)`** — een `security
   definer`-functie die het token nakijkt en **enkel** de overzichtsdata van díé
   ene collectie teruggeeft. De ontvanger heeft geen enkele directe
   tabeltoegang nodig.

### Verificatie na afloop

```
tabel_er = 1 · functie_er = 1
```

Beide op 1, zoals vereist. Aanvullend gemeten dat er verder niets veranderde:

| | vóór | na |
|---|---|---|
| Tabellen in `public` | 21 | 22 |
| Open policies | 20 | 21 |
| Functies in `public` | 0 | 1 |
| Functie draait als eigenaar (`security definer`) | — | ja |

Precies één tabel, één policy en één functie erbij. Niets anders aangeraakt.

---

## 5. De vier tokengevallen — tweezijdig aangetoond

Gemeten als een échte buitenstaander (`begin; set local role anon; …;
rollback;`) tegen collectie *La Vente de Deauville Sélection 2026* (76 lots,
2 veilingdagen — bewust een meerdaagse gekozen, zodat ook de per-dag-sectie
doorlopen wordt).

| Geval | Krijgt data? | Wat komt eruit |
|---|---|---|
| a) geldig token | **ja** | Deauville Sélection 2026 — 76 lots, 2 dagen |
| b) ingetrokken (`revoked_at` gevuld) | **nee** | leeg |
| c) verlopen (`expires_at` in het verleden) | **nee** | leeg |
| d) verzonnen token | **nee** | leeg |

**Lekcontrole bij het geldige token.** De functie levert vier blokken:
collectie, lots, lot-types, dagen. **Nul** lots van een andere collectie. Per
lot komen alleen mee: nummer, naam, verkocht ja/nee, prijs, verkoopkanaal,
tijden, lot-type, charity- en teruggetrokken-vlag. **Geen koper, geen klanten,
geen reserveprijs, geen notities, geen foto's.**

**Visuele controle door Frederik** — dev-server, in een privé-venster (dat
bewijst meteen dat er geen inlog nodig is): het geldige token toont het
overzicht van díé ene veiling, zonder kruimelpad, zonder accountbalk en zonder
klikbare paardennamen. De drie andere tokens tonen alle drie "Link niet (meer)
geldig". Alle vier de gevallen gedroegen zich zoals hierboven beschreven.

**Testdata opgeruimd.** De drie tokens waren zuivere testdata
(`created_by = 'test-stap3'`, label `TESTDATA stap3 — …`) en zijn na afloop
verwijderd. `collection_shares` staat weer op 0 rijen. Dit valt buiten de regel
"audit-spoor is onuitwisbaar": er is nooit een echte deellink mee verstuurd. Een
échte ingetrokken link wordt **niet** gewist maar krijgt `revoked_at` — zo is de
code ook geschreven (`revokeShare()` doet een update, geen delete).

---

## 6. Wat er nog openstaat vóór dit veilig deelbaar is

1. **Server-side doorgeefluik** (stap 2 van het RLS-traject). Zolang dat er niet
   is, zijn de tokens opvraagbaar. Zie de waarschuwing bovenaan.
2. **Vercel-omgevingsvariabelen.** De twee nieuwe variabelen
   `VITE_CENTRAL_AUTH_URL` en `VITE_CENTRAL_AUTH_ANON_KEY` moeten in Vercel
   gezet worden vóór de merge naar `main` live gaat — zonder die twee **start de
   app niet**. Dit stond al open sinds 2 juli en is met deze merge acuut
   geworden.
3. **De worker.** Niet geraakt door deze wijziging; die draait op de scrapers en
   ziet `collection_shares` niet.

---

## 7. Voorstel 0040 — niet aangeraakt, wél een correctie genoteerd

`0040_lockdown_anon_reads.PROPOSAL.sql` is een bewust uitgecommentarieerd
voorstel en is deze sessie **niet uitgevoerd en niet gewijzigd**. Toepassen zou
de hele app breken, omdat de frontend nog als anonieme bezoeker praat.

**Fout in dat bestand, voor later:** de tabellenlijst is incompleet. Er staan er
18 in; er zijn er **20** met een open policy. Ontbrekend: `entity_profiles`,
`entity_aliases`, `lot_entities`. Sinds deze sessie is `collection_shares` de
21e. Wie het voorstel ooit uitvoert zonder die vier toe te voegen, laat vier
deuren openstaan en denkt dat alles dicht is. Niet nu repareren — genoteerd in
`PROJECT_STATUS.md` zodat het niet wegzakt.

---

## 8. Wat er fout kan gaan, en hoe je terugdraait

| Risico | Kans | Wat je merkt | Terugdraaien |
|---|---|---|---|
| Deellink werkt niet na deploy | laag | "Overzicht tijdelijk niet beschikbaar" | Controleer of de Vercel-variabelen gezet zijn |
| App start niet na merge | **reëel** | wit scherm op productie | Zet de twee `VITE_CENTRAL_AUTH_*`-variabelen in Vercel, of activeer de vorige deployment |
| Token uitgelekt | zie §6 | — | Link intrekken via "🔒 Deellinks"; de rij blijft staan met `revoked_at` |
| Migratie 0039 ongewenst | zeer laag | — | Alleen destructief terug te draaien; niet doen zonder backup. De tabel is leeg en stoort niets. |

Code terugdraaien: `git revert <hash>` op de merge-commit, of via Vercel →
Deployments → vorige deployment activeren.

---

## 9. Storing bij de deploy — uitgeschakelde legacy-sleutel (opgelost)

Na de merge kon Frederik niet inloggen op production. De app toonde
*"Inloggen mislukt. Controleer je e-mail en wachtwoord."*

**Het was niet het wachtwoord.** Diagnose in drie metingen:

1. **Account in orde** — één gebruiker in het centrale project
   (`frederik@conceptosaurus.eu`), e-mail bevestigd, niet geblokkeerd, laatste
   geslaagde login 10 augustus 20:34.
2. **Geen enkel spoor van de poging.** In `auth_logs` stond over 2,5 uur geen
   énkel `/token`-verzoek vanuit Veiling Pro — en nul verzoeken met status 400.
   Een fout wachtwoord laat een 400 achter. Er was er geen. Het verzoek bereikte
   de inlogdienst dus helemaal niet.
3. **Oorzaak: de legacy anon-sleutel van het centrale project staat op
   `disabled: true`.** Supabase vervangt de oude JWT-sleutels (`eyJ…`) door
   nieuwe (`sb_publishable_…`); bij het inlogproject is die omschakeling
   doorgevoerd, bij het data-project nog niet. De dode sleutel wordt aan de
   poort geweigerd, vóór de inlogdienst — vandaar de lege logs.

Dit trof **ook de lokale omgeving**, want `.env.local` droeg dezelfde dode
sleutel. Het is dus geen fout in deze wijziging en geen fout in Vercel: de
sleutel is ergens tussen 10 en 13 augustus uitgeschakeld.

**Opgelost** door in `.env.local` én in Vercel de nieuwe publishable sleutel te
zetten en opnieuw te laten bouwen (`VITE_`-variabelen worden bij het bouwen
ingebakken; alleen opslaan is niet genoeg).

**Verificatie:** geslaagde inlog vanaf `localhost:5173` om 12:36:53 (status 200)
en `last_sign_in_at` verspringt naar 13-08 12:39:35 — dat veld beweegt alleen bij
een echte wachtwoord-inlog, niet bij een sessievernieuwing.

### ⚠️ Dit gebeurt binnenkort óók met het data-project

De legacy anon-sleutel van `cjxtwzmryrpwoydrqqil` staat **nu nog op enabled**,
maar gaat dezelfde weg op. Wordt hij uitgeschakeld, dan valt in één klap alles
om: de webapp, de scrape-worker (die dezelfde publieke sleutel gebruikt, zie het
inventarisrapport §3.3) en elk import-script. Het symptoom zal misleidend zijn —
"geen data" of een generieke foutmelding, niet "sleutel ongeldig".

*Voor te zijn, niet nu:* overstappen op `sb_publishable_UpiztYg6P8E6oyRNwwo1bA_p_lv9f8Q`
in `.env.local`, in Vercel en op de worker-machine. Dat raakt de sleutelrotatie
uit stap 4 van het RLS-traject en hoort daar thuis, niet in een losse ingreep.

### Les voor de foutmelding

`LoginScreen.jsx` vertaalt **elke** fout van de inlogdienst naar dezelfde zin
over e-mail en wachtwoord — ook "sleutel ongeldig", wat niets met het wachtwoord
te maken heeft. Die melding stuurde de diagnose actief de verkeerde kant op. Bij
een volgende ronde: de onderliggende foutcode tonen of loggen.

---

## 10. Herkomst van elk getal

Alle metingen op 13 augustus 2026, tegen project `cjxtwzmryrpwoydrqqil`.

| # | Wat | Bron |
|---|---|---|
| M1 | Tabel/functie afwezig vóór de migratie | `pg_class` + `pg_proc`, schema public |
| M2 | 0 functies, 21 tabellen in de uitgangstoestand | idem |
| M3 | Nul commits op beide feature-takken | `git rev-list --count main..<tak>`, lokaal én `origin/` |
| M4 | Alle 30 kolommen van 0039 bestaan | `information_schema.columns` |
| M5 | Tabel + functie aanwezig ná de migratie (1 / 1) | de verificatiequery uit de opdracht |
| M6 | 22 tabellen · 21 policies · 1 functie · definer=true | `pg_class`, `pg_policies`, `pg_proc` |
| M7 | Vier tokengevallen als rol `anon` | `begin; set local role anon; …; rollback;` |
| M8 | Lekcontrole: 0 lots van een andere collectie; veldenlijst | `jsonb_object_keys` op het antwoord van de functie |
| M9 | Testtokens verwijderd, tabel op 0 rijen | `delete … returning`, daarna `count(*)` |
| M10 | Visuele controle van de vier URL's | Frederik, dev-server in privé-venster |
| M11 | Account bestaat, bevestigd, niet geblokkeerd | `auth.users` in `igunbmpreaqrlyqnxeud` |
| M12 | Nul `/token`-verzoeken vanuit Veiling Pro, nul 400's | `auth_logs`, venster 10:00–12:30 UTC |
| M13 | Legacy anon-sleutel centraal project `disabled: true` | Supabase API-sleutels, einde `GK2VR0HI` |
| M14 | Legacy anon-sleutel data-project nog `enabled` | idem, project `cjxtwzmryrpwoydrqqil` |
| M15 | Herstel: 200 vanaf `localhost:5173` 12:36:53; `last_sign_in_at` → 13-08 12:39:35 | `auth_logs` + `auth.users` |
