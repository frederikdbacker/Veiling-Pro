# Veiling Pro — deellink-tabel dichtgezet (migratie 0041)

**Datum:** 13 augustus 2026, 13:07–13:16 UTC
**Project:** cjxtwzmryrpwoydrqqil (Supabase)
**Branch:** `fix/collection-shares-lockdown` (nog te maken en te committen — zie sectie 8)
**Voorafgaand:** `reports/2026-08-13_rls-inventaris-stap1.md` (stap 1) en
`reports/2026-08-13_deellink-afronden.md` (migratie 0039)

---

## 1. In gewone taal

De deelknop werkte, maar de lade waar de deellinks in liggen zat niet op slot.
Iedereen die de publieke sleutel uit de browser plukt, kon die lade opentrekken:
alle links tegelijk uitlezen, er zelf een link in leggen, en — het vervelendste —
een ingetrokken link weer aanzetten. "Intrekken" was dus geen slot maar een
schakelaar die iedereen kon omzetten.

Er is niets misgegaan: de lade stond leeg en er is nooit een link verstuurd.
Dat is precies waarom dit nu gerepareerd is en niet later.

Wat er nu staat: de lade zelf is niet meer te openen. Het beheer loopt via drie
afgeschermde loketten — één om een link te maken of de bestaande terug te
krijgen, één om de lijst te tonen, één om in te trekken. Een loket om iets
weer áán te zetten bestaat niet meer; dat pad is gewoon verdwenen.

---

## 2. Wat er precies mis was — gemeten, niet afgeleid

Meting 13-08-2026 13:02:55 UTC, als rol `anon`, in een teruggedraaide transactie.
Migratie 0039 gaf `collection_shares` dezelfde policy als de rest van het schema:

```
"anon read/write collection_shares" | roles={public} | cmd=ALL | qual=true | with_check=true
```

| Wat als anon lukte | Gevolg |
|---|---|
| `select * from collection_shares` | alle tokens van alle veilingen leesbaar |
| `insert` met een zelfgekozen token | eigen deellink planten |
| `update … set revoked_at = null` | ingetrokken link weer activeren |

De vier bewezen tokengevallen (geldig / ingetrokken / verlopen / verzonnen) uit
het rapport van 0039 golden alleen **door** `get_shared_collection_summary` heen.
Eromheen waren ze alle vier te omzeilen.

**Geen incident.** Nul rijen in de tabel, nooit een link verstuurd.

---

## 3. Uitgangstoestand vóór de ingreep (13:07:42 UTC)

| Meting | Waarde |
|---|---|
| tabellen in `public` | 22 |
| policies in `public` | 21 |
| functies in `public` | 1 (`get_shared_collection_summary`) |
| policies op `collection_shares` | 1, letterlijk zoals hierboven |
| rijen in `collection_shares` | 0 |
| RLS op `collection_shares` | aan |

---

## 4. Wat migratie 0041 doet

Bestand: `supabase/migrations/0041_collection_shares_lockdown.sql`.
Toegepast op productie op 13-08-2026 na expliciete bevestiging van Frederik.
**Niet additief** — hij verwijdert een policy. Een gegevensback-up was zinloos
(nul rijen); de oude policy staat woordelijk in dit rapport en in het
terugdraai-blok onderaan het migratiebestand.

1. **Policy weg.** `drop policy "anon read/write collection_shares"`. RLS blijft
   aan. Een tabel met RLS aan en zonder policy houdt alles tegen — dat is geen
   aanname maar het bewezen gedrag van `collection_spotters_backup_0038` uit het
   inventarisrapport.

2. **Drie SECURITY DEFINER-functies**, één per plek waar `src/lib/shares.js` de
   tabel raakte:

   | Functie | Vervangt | Was in shares.js |
   |---|---|---|
   | `get_or_create_collection_share(uuid)` | `getOrCreateShare()` | regel 45 (select) + regel 62 (insert) |
   | `list_collection_shares(uuid)` | `listShares()` | regel 72 (select) |
   | `revoke_collection_share(uuid)` | `revokeShare()` | regel 87 (update) |

   `listShares()` was de makkelijk te missen derde: die vult
   `ShareLinksModal.jsx`. Overgeslagen zou de modal geen foutmelding tonen maar
   een lege lijst — stil kapot.

3. **`search_path` staat bij alle drie expliciet vast op `public`**, het patroon
   dat 0039 al goed doet. Dit is de klassieke valkuil bij SECURITY DEFINER:
   zonder vaste `search_path` kan een aanroeper de functie naar eigen tabellen
   laten kijken. Geverifieerd na afloop: alle vier de functies hebben
   `prosecdef = true` en `proconfig = search_path=public`.

4. **`fetchSharedSummary()` is ongewijzigd** en blijft werken: SECURITY DEFINER
   loopt RLS voorbij.

### Drie keuzes die ik zelf gemaakt heb

- **Het token wordt nu server-side gegenereerd** (twee uuid's aaneen, 64
  hex-tekens, ±244 willekeurige bits) in plaats van door de browser. Reden: zo
  kan niemand een zelfgekozen of vooraf bekend token laten opslaan. De browser
  levert geen tokenwaarde meer aan.
- **`created_by` staat vast op `'frederik'`** binnenin de functie; de aanroeper
  kan die audit-waarde niet meer opgeven. Vervangen zodra dit project echte
  auth heeft.
- **`revoke_collection_share()` raakt alleen rijen waar `revoked_at` nog leeg
  is.** Een eenmaal gezet intrekmoment is daarmee onoverschrijfbaar, en er
  bestaat geen enkel pad meer om een ingetrokken link te heractiveren. Dat sluit
  jouw zwaarste vondst structureel af in plaats van via een regel tekst.

### Wat ik bewust NIET heb aangeraakt

De tabel-grants op `collection_shares` blijven staan zoals ze waren. Opdracht was
"wijzig niets anders"; grants horen bij stap 5 en de rest van het traject hangt
aan de gemeten uitgangstoestand. RLS zonder policy is hier het slot — het tweede
slot volgt later.

---

## 5. Toestand ná de ingreep (13:13:29 UTC)

| Meting | Vóór | Ná | Oordeel |
|---|---|---|---|
| tabellen in `public` | 22 | 22 | ongewijzigd |
| policies in `public` | 21 | **20** | precies één weg, de bedoelde |
| functies in `public` | 1 | **4** | precies drie erbij |
| policies op `collection_shares` | 1 | **0** | tabel dicht |
| rijen in `collection_shares` | 0 | 0 | ongewijzigd |
| alle functies `security definer` + `search_path=public` | — | 4/4 | correct |
| uitvoerrecht op de drie nieuwe functies | — | `anon`, `authenticated` (+ Supabase-standaard `service_role`); `public` ingetrokken | zoals bedoeld |

---

## 6. Tweezijdige acceptatie

### (b) De drie weigeringstoetsen — als `anon`, in een teruggedraaide transactie

Opzet: als eigenaar één controlerij aangemaakt (vast id `…0041`, ingetrokken),
daarna rol `anon` aangenomen. Alles teruggedraaid; achteraf geverifieerd dat de
tabel weer op 0 rijen staat en er geen hulptabellen zijn achtergebleven.

| # | Toets | Uitkomst |
|---|---|---|
| b1 | rechtstreekse `SELECT` op `collection_shares` | **0 rijen zichtbaar** |
| b1-controle | dezelfde rij via `list_collection_shares` | **1 rij** — de rij bestáát dus |
| b2 | `UPDATE … set revoked_at = null` op de controlerij | **0 rijen gewijzigd** |
| b3 | `INSERT` van een eigen token | **geweigerd:** `new row violates row-level security policy for table "collection_shares"` |

Regel b1-controle is de reden dat b1 iets betekent: dezelfde transactie,
dezelfde tabel, één weg die nul geeft en één weg die de rij wél toont. De toets
werkt; de nul is een echte nul.

### (a) Het werkende pad — als `anon`, via de functies

| # | Stap | Uitkomst |
|---|---|---|
| h1 | aanmaken via `get_or_create_collection_share` | `reused=false`, token van 64 tekens |
| h2 | nogmaals aanmaken | `reused=true`, **hetzelfde token** — geen wildgroei |
| h3 | lijst via `list_collection_shares` | 2 links (actief + ingetrokken) |
| h4 | gedeeld overzicht met de nieuwe link | werkt: collectie "Fences ELITE — 02/09/2009", 29 lots |
| h5 | intrekken via `revoke_collection_share` | `true` |
| h6 | lijst na intrekken | 0 actieve links over |

Tweede transactie, de vier tokengevallen opnieuw langs het nieuwe pad:

| Stap | Uitkomst |
|---|---|
| geldig token → overzicht | werkt |
| zelfde token ná intrekken → overzicht | niets (correct) |
| verzonnen token → overzicht | niets (correct) |
| nieuwe link ná intrekken aanmaken | `reused=false` — de deelknop blijft dus bruikbaar |

**Nog te doen door Frederik:** de visuele helft van (a) — open een collectie,
klik "🔒 Deellinks", en controleer dat aanmaken, de lijst tonen én intrekken
werken, en dat de link zelf in een privé-venster het overzicht opent. De
machinehelft hierboven bewijst dat de functies werken; alleen jouw klik bewijst
dat de knoppen ze ook aanroepen.

---

## 7. Restrisico — eerlijk gemeld

De drie functies zijn aanroepbaar door `anon`, want de app praat op dit project
nog steeds als anonieme bezoeker (de login leeft in het aparte project
`igunbmpreaqrlyqnxeud`). Wat een buitenstaander met de publieke sleutel dús nog
kan:

- per veiling de links van díé veiling opvragen (niet meer alle links tegelijk,
  en hij moet het interne veiling-nummer al kennen);
- een nieuwe link laten aanmaken voor een veiling.

Wat hij **niet** meer kan:

- alle tokens over alle veilingen heen uitlezen;
- een token van eigen keuze planten (de server bepaalt de waarde);
- een ingetrokken link weer activeren (dat pad bestaat niet meer);
- een gezet intrekmoment overschrijven.

Dat restant sluit pas bij **stap 2**, het server-side doorgeefluik met echte
autorisatie. Deze sessie haalt de scherpe randen eraf, niet meer dan dat. Wie
later leest dat "collection_shares dicht is", moet deze alinea meelezen.

Voetnoot bij de adviseur van Supabase: die zal over de drie nieuwe functies
waarschuwen ("SECURITY DEFINER"). Dat is by design — dat ís het afgeschermde
pad. Diezelfde adviseur zweeg over de openstaande policy hierboven, want hij
controleert op RLS-uit en RLS-zonder-policy, niet op een policy die alles
toestaat.

---

## 8. Wat er in de code veranderde

Eén bestand: `src/lib/shares.js`.

- `generateToken()` verwijderd (het token komt nu van de server).
- `getOrCreateShare()`, `listShares()` en `revokeShare()` roepen elk hun functie
  aan in plaats van de tabel.
- `fetchSharedSummary()` en `shareUrl()` ongewijzigd.
- De vorm van wat de functies teruggeven is gelijk gebleven, dus
  `ShareLinksModal.jsx`, `CollectionPage.jsx` en `SharedSummaryPage.jsx` hoefden
  niet mee te veranderen.

Geen enkel script in `scripts/` of `bin/` raakt `collection_shares` — nagekeken
over de hele repo.

---

## 9. Wat kan er misgaan, en hoe draai je het terug

| Symptoom | Waarschijnlijke oorzaak | Wat te doen |
|---|---|---|
| "🔒 Deellinks" toont een **lege lijst** zonder foutmelding | de lijstfunctie wordt niet aangeroepen | melden; niet zelf sleutelen |
| Foutmelding "onbekende collectie" bij aanmaken | verkeerd veiling-nummer doorgegeven | melden |
| `/gedeeld/<token>` zegt "link ongeldig" voor een verse link | leesfunctie of token-doorgifte stuk | melden |

Terugdraaien staat als kant-en-klaar blok onderaan
`supabase/migrations/0041_collection_shares_lockdown.sql`: de drie functies weg
en de oude policy terug. Dan staat het gat van 13-08 weer open — alleen
tijdelijk gebruiken.

---

## 10. Herkomst van elk getal

| # | Wat | Bron | Tijdstip (UTC) |
|---|---|---|---|
| M1 | uitgangstoestand: 22 tabellen, 21 policies, 1 functie, 0 rijen, policy-tekst | `pg_class` + `pg_policies` + `pg_proc` + `count(*)` | 13:07:42 |
| M2 | migratie 0041 toegepast | `apply_migration` | ±13:12 |
| M3 | eindtoestand: 20 policies, 4 functies, 0 policies op shares, `prosecdef`/`proconfig`/rechten per functie | `pg_policies` + `pg_proc` | 13:13:29 |
| M4 | weigeringstoetsen b1/b1-controle/b2/b3 + happy path h1–h6 | `begin; … set local role anon; … rollback;` | ±13:15 |
| M5 | vier tokengevallen langs het nieuwe pad | idem, tweede transactie | ±13:15 |
| M6 | schoon achteraf: 0 rijen, 22 tabellen, 20 policies, 0 hulptabellen | `pg_class` + `count(*)` | 13:16:27 |

---

## 11. Overdracht

- **Build-check:** kan hier niet gedraaid worden (de `node_modules` is voor
  macOS, deze omgeving is Linux; `npm install` zou je lokale installatie slopen).
  Draai `npm run build` op je Mac en plak de uitvoer.
- **Committen/pushen:** kan hier niet. De commando's staan kant-en-klaar in de
  terugmelding.
- **Twee punten genoteerd, niet gerepareerd:** de incomplete tabellenlijst in
  `0040_lockdown_anon_reads.PROPOSAL.sql` en de twee gelijktijdig geldige
  anon-sleutels. Beide staan in `PROJECT_STATUS.md`.
