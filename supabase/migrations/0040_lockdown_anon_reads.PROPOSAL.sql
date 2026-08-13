-- ============================================================================
-- ⚠️  VOORSTEL — NIET AUTOMATISCH TOEPASSEN  ⚠️
-- Migratie 0040 (PROPOSAL): anon-toegang tot de data-tabellen dichtzetten.
-- ============================================================================
--
-- WAAROM DIT EEN VOORSTEL IS EN NIET ZOMAAR DRAAIT
-- ------------------------------------------------
-- Vandaag staat élke data-tabel op `using(true)` (open lezen én schrijven met
-- de publieke anon-key). De frontend leunt daar volledig op: er is nog GEEN
-- echte auth op het data-project — de centrale login (project igunbmpreaqrlyqnxeud)
-- bewaakt alleen WIE het scherm ziet, niet de data (los JWT-geheim, los project).
--
-- Als je onderstaande policies NU toepast, gaat de hele interne app stuk: elke
-- .from('...')-call met de anon-key krijgt lege resultaten / schrijffouten.
--
-- Dit bestand is daarom een GEMARKEERD voorstel. Pas het pas toe NADAT het
-- data-project achter echte auth zit, in deze volgorde:
--
--   1. Data-project onder dezelfde centrale login brengen (of een edge-function
--      /API-tussenlaag die het centrale token verifieert), zodat ingelogde
--      gebruikers een `authenticated`-rol hebben tegen het data-project.
--   2. De frontend laten schrijven/lezen als `authenticated` i.p.v. `anon`.
--   3. De worker/scripts blijven de service-role-key gebruiken (die omzeilt RLS).
--   4. PAS DAN dit bestand draaien.
--
-- Na toepassing is het enige anon-pad naar data de functie
-- get_shared_collection_summary(token) uit 0039 — d.w.z. een niet-ingelogde
-- ontvanger van een deellink kan UITSLUITEND die ene gedeelde collectie lezen,
-- en niets anders. Dát is de volledige afscherming die de deellink-weergave
-- forward-compatible maakt.
--
-- Onderstaande lijst dekt de tabellen die de frontend aanspreekt (zie het
-- centrale-login-auditrapport). Pas de rollen aan je uiteindelijke auth-keuze aan.

/*  -- Bewust uit-gecommentarieerd zodat een per-ongeluk-run niets doet.

begin;

-- Patroon per tabel: open anon-policy vervangen door authenticated-only.
-- (De worker gebruikt de service-role-key en wordt door RLS niet geraakt.)

do $$
declare
  t text;
  data_tables text[] := array[
    'lots','collections','collection_spotters','collection_days',
    'lot_interested_clients','collection_lot_types','scrape_jobs','lot_types',
    'worker_heartbeat','clients','bid_step_rules','auction_houses',
    'collection_breaks','client_collection_seating','spotters',
    'house_committee_members','lot_sale_corrections','collection_shares'
  ];
begin
  foreach t in array data_tables loop
    execute format('alter table %I enable row level security', t);
    -- oude open policy weg
    execute format('drop policy if exists "anon read/write %s" on %I', t, t);
    execute format('drop policy if exists "anon read/write %I" on %I', t, t);
    -- enkel ingelogde gebruikers
    execute format($f$
      create policy "authenticated full access %s" on %I
        for all to authenticated using (true) with check (true)
    $f$, t, t);
  end loop;
end $$;

-- De gedeelde-overzichtsfunctie blijft expliciet aanroepbaar door anon.
grant execute on function get_shared_collection_summary(text) to anon, authenticated;

commit;

*/
