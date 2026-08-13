-- Migratie 0041: collection_shares dicht — directe tabeltoegang vervangen door
-- drie afgeschermde functies.
--
-- WAAROM (gemeten 13-08-2026 13:02:55 UTC, als rol anon, in een teruggedraaide
-- transactie): migratie 0039 gaf collection_shares dezelfde alles-open policy
-- als de rest van het schema, zodat de beheer-UI de links kon beheren. Gevolg:
-- als anon lukte een insert van een eigen token, lukte het uitlezen van ALLE
-- tokens over alle collecties heen, en lukte het terugzetten van revoked_at
-- naar null — een ingetrokken deellink was dus weer te activeren. De vier
-- bewezen tokengevallen (geldig / ingetrokken / verlopen / verzonnen) golden
-- alleen DOOR get_shared_collection_summary heen; eromheen waren ze alle vier
-- te omzeilen.
-- Geen incident: de tabel stond op nul rijen en er is nooit een link verstuurd.
--
-- WAT DEZE MIGRATIE DOET
--   1. De policy "anon read/write collection_shares" gaat weg. RLS blijft aan;
--      een tabel met RLS aan en zonder policy houdt alles tegen (bewezen door
--      collection_spotters_backup_0038, zie reports/2026-08-13_rls-inventaris-stap1.md).
--   2. Drie SECURITY DEFINER-functies nemen het beheer over — precies de drie
--      plekken waar src/lib/shares.js de tabel raakte:
--        get_or_create_collection_share()  <- getOrCreateShare()  (select + insert)
--        list_collection_shares()          <- listShares()        (select)
--        revoke_collection_share()         <- revokeShare()       (update)
--      get_shared_collection_summary() (0039) blijft ongewijzigd en blijft
--      werken: SECURITY DEFINER loopt RLS voorbij.
--   3. Bij elke functie staat search_path expliciet vast op public — de
--      klassieke valkuil bij SECURITY DEFINER. 0039 doet dat al goed; dit volgt
--      hetzelfde patroon.
--
-- BEWUSTE KEUZES
--   * Het token wordt voortaan SERVER-SIDE gegenereerd (twee uuid's aaneen =
--     64 hex-tekens, ±244 willekeurige bits). De browser levert geen tokenwaarde
--     meer aan, dus niemand kan een zelfgekozen of vooraf bekend token planten.
--   * created_by staat vast op 'frederik' in de functie; de aanroeper kan die
--     audit-waarde niet meer opgeven. Vervangen zodra dit project echte auth
--     heeft (stap 2, doorgeefluik).
--   * revoke_collection_share() raakt alleen rijen waar revoked_at NOG null is.
--     Een eenmaal gezet intrekmoment is dus onoverschrijfbaar, en er bestaat
--     geen pad meer om revoked_at terug te zetten naar null.
--   * De tabel-grants op collection_shares blijven staan zoals ze zijn. Dat is
--     opzettelijk: de rest van het RLS-traject hangt aan de gemeten
--     uitgangstoestand, en grants worden in stap 5 als één geheel aangepakt.
--     RLS zonder policy is hier het slot.
--
-- RESTRISICO, EERLIJK GEMELD: de drie functies zijn aanroepbaar door anon,
-- want de app praat op dit project nog als anon (de login leeft in het aparte
-- project igunbmpreaqrlyqnxeud). Een buitenstaander kan dus nog steeds PER
-- COLLECTIE de links opvragen en een nieuwe link laten aanmaken — maar niet
-- meer alle tokens in één keer opvragen, niet meer een token van eigen keuze
-- planten, en niet meer een ingetrokken link opnieuw activeren. Dat restant
-- sluit pas bij stap 2 (server-side doorgeefluik + echte autorisatie).
--
-- NIET additief: deze migratie verwijdert een policy. Toegepast op 13-08-2026
-- na expliciete bevestiging van Frederik; collection_shares stond op 0 rijen,
-- dus er was geen data om te back-uppen. Terugdraaien = het blok onderaan.

begin;

-- 1. De alles-open policy weg -----------------------------------------------
drop policy if exists "anon read/write collection_shares" on collection_shares;

-- RLS staat al aan sinds 0039; hier voor de zekerheid nogmaals (idempotent).
alter table collection_shares enable row level security;

-- 2. Aanmaken-of-hergebruiken ------------------------------------------------
-- Vervangt getOrCreateShare(): de select op regel 45 én de insert op regel 62.
-- Geeft de bestaande actieve link terug als die er is, anders een nieuwe.
create or replace function get_or_create_collection_share(p_collection_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_collection_id is null then
    raise exception 'collection_id is verplicht';
  end if;

  if not exists (select 1 from collections c where c.id = p_collection_id) then
    raise exception 'onbekende collectie';
  end if;

  -- Bestaande actieve link? (niet ingetrokken, niet verlopen)
  select s.token
    into v_token
  from collection_shares s
  where s.collection_id = p_collection_id
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now())
  order by s.created_at desc
  limit 1;

  if v_token is not null then
    return jsonb_build_object('token', v_token, 'reused', true);
  end if;

  -- Nieuw token, server-side: 64 hex-tekens uit twee willekeurige uuid's.
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into collection_shares (collection_id, token, created_by)
  values (p_collection_id, v_token, 'frederik');

  return jsonb_build_object('token', v_token, 'reused', false);
end;
$$;

-- 3. Lijst tonen -------------------------------------------------------------
-- Vervangt listShares() (regel 72). Dit is de functie die ShareLinksModal.jsx
-- vult; wie hem overslaat krijgt geen foutmelding maar een lege lijst.
create or replace function list_collection_shares(p_collection_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',         s.id,
        'token',      s.token,
        'label',      s.label,
        'created_at', s.created_at,
        'revoked_at', s.revoked_at,
        'expires_at', s.expires_at
      )
      order by s.created_at desc
    ),
    '[]'::jsonb
  )
  from collection_shares s
  where s.collection_id = p_collection_id;
$$;

-- 4. Intrekken ---------------------------------------------------------------
-- Vervangt revokeShare() (regel 87). Zet enkel revoked_at op rijen waar die nog
-- leeg is: het intrekmoment is daarmee onoverschrijfbaar en er is geen pad meer
-- om een ingetrokken link te heractiveren. De rij wordt nooit gewist (audit).
create or replace function revoke_collection_share(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  update collection_shares
     set revoked_at = now()
   where id = p_id
     and revoked_at is null;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- 5. Uitvoerrechten ----------------------------------------------------------
-- Alleen anon + authenticated; niet de brede rol public.
revoke all on function get_or_create_collection_share(uuid) from public;
revoke all on function list_collection_shares(uuid)         from public;
revoke all on function revoke_collection_share(uuid)        from public;

grant execute on function get_or_create_collection_share(uuid) to anon, authenticated;
grant execute on function list_collection_shares(uuid)         to anon, authenticated;
grant execute on function revoke_collection_share(uuid)        to anon, authenticated;

commit;

-- ============================================================================
-- TERUGDRAAIEN (alleen als de deelknop hierdoor breekt en er geen tijd is om
-- te diagnosticeren). Zet de oude toestand exact terug:
--
--   begin;
--   drop function if exists get_or_create_collection_share(uuid);
--   drop function if exists list_collection_shares(uuid);
--   drop function if exists revoke_collection_share(uuid);
--   create policy "anon read/write collection_shares"
--     on collection_shares for all
--     using (true) with check (true);
--   commit;
--
-- Let op: dan staat het gat van 13-08 weer open. Draai dit alleen tijdelijk.
-- ============================================================================
