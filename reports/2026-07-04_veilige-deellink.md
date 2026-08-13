# Audit-rapport — Veilige deellink voor het eindoverzicht

**Datum:** 4 juli 2026
**Branch:** `feat/veilige-deellink` (nog niet gecommit/gepusht/gemerged — wacht op Frederiks visuele controle)
**Thema:** de "deelbare link" naar organisatoren afschermen zodat ze niet naar de
rest van de app kunnen, met een niet-raadbare URL en gescoopte data.

> Deze branch bouwt vóórt op de nog-niet-gecommitte centrale-login-werkmap
> (`feat/centrale-login`). Die losse wijzigingen zijn onaangeroerd meegenomen.

---

## In gewone taal — wat was het probleem?

Frederik deelt het **eindoverzicht** van een veiling met de organisatie. Tot nu
was die "deellink" gewoon de **interne** overzichtspagina
(`/collections/<uuid>/summary`). Daar staat bovenaan een **kruimelpad** ("Cookie
Crumble" = breadcrumb: *Veilinghuizen › Huis › Collectie › Overzicht*) met échte
links, en elk lot linkt door naar zijn eigen pagina. Eén klik en de ontvanger
zat in de **volledige app** — alle veilingen, alle klanten, alles. Dat is voor
organisatoren een absolute no-go.

Daarbovenop: de data zelf staat in Supabase met **volledig open leesrechten**.
Zelfs met een nettere link kon een technische ontvanger met de publieke sleutel
rechtstreeks álle data opvragen.

---

## Wat is er gebouwd (de drie lagen)

**1. Een niet-raadbare deellink, los van de app-structuur.**
De link is nu `/gedeeld/<token>`, waar het token een **lang, willekeurig**
(192-bit) getal is — niet ophoogbaar, verraadt niets van de app. De knop
"📋 Link kopiëren" op de collectiepagina maakt (of hergebruikt) zo'n link. Een
nieuwe knop "🔒 Deellinks" toont alle links en laat ze **intrekken**.

**2. Een kale gedeelde weergave, zonder uitgangen.**
`/gedeeld/<token>` toont een aparte pagina **zonder** breadcrumb, **zonder** de
accountbalk, **zonder** links naar lots of andere routes en **zonder**
correctieknoppen. Puur lezen. Er is letterlijk nergens om op te klikken
(geverifieerd: 0 links, 0 nav, 0 knoppen op de pagina).

**3. Data gescoopt tot enkel die ene veiling.**
De gedeelde weergave leest **niet** rechtstreeks uit de tabellen, maar via één
databankfunctie `get_shared_collection_summary(token)` die het token valideert
en **enkel het overzicht van die ene collectie** teruggeeft. Ongeldig,
ingetrokken of verlopen token → niets. Deze functie is bewust zó gebouwd dat ze
blijft werken zodra de brede afscherming (zie onder) volgt.

**Uitbreken lukt niet meer:** wie vanuit de deellink handmatig naar `/` (of een
andere interne route) surft, botst op het **inlogscherm** van de centrale login.
Zonder account geen interne toegang.

---

## Gewijzigde/nieuwe bestanden

| Bestand | Wat |
|---|---|
| `supabase/migrations/0039_collection_shares.sql` | **NIEUW** — tabel `collection_shares` (token, intrekbaar, optionele vervaldatum) + de `SECURITY DEFINER`-functie `get_shared_collection_summary(token)`. Additief + idempotent. **Geleverd als bestand, niet toegepast.** |
| `supabase/migrations/0040_lockdown_anon_reads.PROPOSAL.sql` | **NIEUW, GEMARKEERD VOORSTEL** — zet anon-leesrechten op de datatabellen dicht. Volledig uit-gecommentarieerd; **niet draaien** vóór het data-project achter echte auth zit (anders breekt de hele interne app). |
| `src/lib/shares.js` | **NIEUW** — token genereren, link maken/hergebruiken/intrekken, en het overzicht via de RPC ophalen. |
| `src/pages/SharedSummaryPage.jsx` | **NIEUW** — de kale publieke weergave (`/gedeeld/:token`). |
| `src/components/SummaryView.jsx` | **NIEUW** — de presentatie van het overzicht, gedeeld door de interne én de gedeelde pagina. In `shared`-modus: geen links, geen correctieknoppen. |
| `src/lib/summaryStats.js` | **NIEUW** — pure rekenlaag (cijfers + formatters), zodat beide weergaven identiek rekenen. |
| `src/components/ShareLinksModal.jsx` | **NIEUW** — beheer van deellinks (kopiëren, nieuwe, intrekken). |
| `src/components/AuthLayout.jsx` | **NIEUW** — de login-poort + chrome rond de interne routes (via `<Outlet/>`). |
| `src/App.jsx` | Routing herzien: publieke `/gedeeld/:token` **buiten** de poort; alle interne routes onder `AuthLayout`. |
| `src/main.jsx` | `BrowserRouter` staat nu boven de poort, zodat de publieke route bereikbaar is. Gedrag van de gate ongewijzigd. |
| `src/pages/CollectionSummaryPage.jsx` | Uitgedund tot data-loader die `SummaryView` + `computeSummary` gebruikt. Interne weergave identiek. |
| `src/pages/CollectionPage.jsx` | "Link kopiëren" maakt nu een `/gedeeld/<token>`-link; knop "🔒 Deellinks" toegevoegd. |

---

## De nieuwe URL-vorm

- **Vroeger:** `https://…/collections/725747f9-86d3-4b5f-9bff-6e98feb9ddb8/summary`
  (verraadt structuur; breadcrumb + lot-links naar de hele app).
- **Nu:** `https://…/gedeeld/9f3c2a…<48 hex>` — willekeurig, niet-raadbaar,
  intrekbaar, geen enkele uitgang.

---

## Getest (live op `npm run dev`, publieke route — geen login nodig)

- ✅ `/gedeeld/<onbekend token>` → neutraal scherm, **geen** breadcrumb/nav/account.
  (Toont nu "tijdelijk niet beschikbaar" omdat de RPC in productie nog niet
  bestaat — de migratie is bewust niet gedraaid.)
- ✅ Kale happy-path (met tijdelijke test-data, nadien verwijderd): volledig
  overzicht — kerncijfers, per dag, per type, per lot — **0 links, 0 nav, 0
  knoppen** op de pagina (DOM-geverifieerd).
- ✅ Vanuit de deellink naar `/` surfen → **inlogscherm** (interne app afgeschermd).
- ✅ `npm run build` groen. Geen console-fouten.

**Screenshots** (in de sessie getoond): (1) kale overzichtsweergave zonder
navigatie, (2) "link ongeldig/niet beschikbaar"-scherm, (3) inlogscherm bij een
poging tot uitbreken naar `/`.

**Nog niet visueel herbekeken:** de *interne* overzichtspagina achter de login
(vereist Frederiks account). De presentatie is dezelfde `SummaryView` die in de
kale weergave wél live is bevestigd, en de build is groen — regressierisico laag,
maar graag één blik van Frederik na inloggen.

---

## Wat is er nog nodig om écht live te gaan

1. **Migratie 0039 draaien** tegen het data-project (Supabase SQL Editor, ná
   0038). Additief + idempotent; pas daarna werkt de gedeelde weergave met echte
   data. *Bewust niet door mij toegepast (opdrachtregel: geen migratie tegen
   productie).*
2. **De centrale login deployen** (branch `feat/centrale-login`). Zonder de gate
   zijn de interne routes niet afgeschermd — dan is de deellink netjes, maar kan
   men `/` nog gewoon openen. De volledige garantie = deellink-branch **+** login.
3. **Restrisico op dataniveau (belangrijk, eerlijk):** zolang de RLS overal
   `using(true)` staat, kan een technische ontvanger met de publieke sleutel de
   tabellen nog rechtstreeks bevragen — buiten de deellink om. De **nette**
   weergave en de RPC lossen de UI-/deeplink-uitbraak volledig op; het
   **data**-gat sluit pas met voorstel **0040** (dat de tabellen dichtzet en de
   RPC als enige anon-pad laat). 0040 mag pas ná stap 2 + een echte data-auth
   (zie het centrale-login-rapport, taak HOOG). Daarom geleverd als gemarkeerd
   voorstel, niet blind toegepast.

---

## Aandachtspunt voor Frederik (product)

De **debrief-tekst** staat óók in de gedeelde weergave (zoals vandaag al het
geval was op de summary-pagina). Als daar ooit interne notities in staan die
organisatoren niet mogen zien, kan ik die in de gedeelde modus verbergen —
zeg maar of dat moet.

---

## Rollback

Alles op branch `feat/veilige-deellink`. Geen schema-/datamutatie uitgevoerd
(0039/0040 zijn bestanden). Terug: `git checkout feat/centrale-login`.
