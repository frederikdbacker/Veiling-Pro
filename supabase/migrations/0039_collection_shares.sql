-- Migratie 0039: collection_shares — niet-raadbare deellinks voor het
-- eindoverzicht, met een SECURITY DEFINER-leespad dat enkel die ene collectie
-- teruggeeft.
--
-- Context (zie reports/2026-07-04_veilige-deellink.md):
-- Frederik deelt het eindoverzicht van een veiling met organisatoren. Tot nu
-- gebeurde dat via de INTERNE route /collections/<uuid>/summary. Die weergave
-- toont een breadcrumb + lot-links naar de rest van de app, en de open RLS
-- (using(true)) laat een ontvanger met de publieke key álle data lezen. Deze
-- migratie legt de basis voor een afgeschermde deellink:
--
--   * collection_shares  = een tabel met een lang, willekeurig token per
--                          gedeelde collectie (intrekbaar, optioneel vervaldatum).
--   * get_shared_collection_summary(token) = een SECURITY DEFINER-functie die
--                          het token valideert en ENKEL de overzichtsdata van die
--                          ene collectie teruggeeft (collectie-meta + lots +
--                          gebruikte lot-types + veilingdagen). anon mag alleen
--                          deze functie aanroepen — geen directe tabeltoegang
--                          nodig voor de gedeelde weergave.
--
-- Forward-compatible: zodra de brede RLS-lockdown volgt (zie het GEMARKEERDE
-- voorstel 0040_lockdown_anon_reads.PROPOSAL.sql) blijft de gedeelde weergave
-- werken via deze functie, terwijl de rest van de data voor anon dicht gaat.
--
-- VEILIG: volledig additief + idempotent (create table/function ... if not
-- exists / or replace, drop policy if exists -> create policy). Geen bestaande
-- tabel/kolom/policy geraakt. RLS op collection_shares volgt het bestaande
-- MVP-patroon (permissive) zodat de admin-UI de links kan beheren zolang het
-- data-project nog geen echte auth heeft; de functie hangt daar NIET van af.
--
-- NIET automatisch toegepast tegen productie (opdrachtregel): dit bestand wordt
-- geleverd; Frederik/adviseur draait het bewust één keer in de Supabase SQL
-- Editor, ná 0038.

begin;

-- 1. Tabel collection_shares -------------------------------------------------
create table if not exists collection_shares (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,                              -- lang, willekeurig, URL-veilig (client-gegenereerd, 192-bit)
  collection_id uuid not null references collections(id) on delete cascade,
  label         text,                                              -- optionele omschrijving (bv. 'Voor jury Megève')
  created_by    text,                                              -- 'frederik' (toekomst: user-id); audit
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz,                                       -- null = actief; ingevuld = ingetrokken
  expires_at    timestamptz                                        -- null = geen vervaldatum
);

create index if not exists idx_collection_shares_token      on collection_shares(token);
create index if not exists idx_collection_shares_collection on collection_shares(collection_id);

-- 2. RLS — permissive, consistent met de rest van het MVP-schema -------------
-- Zolang het data-project nog geen echte auth heeft, beheert de admin-UI de
-- deellinks met de anon-key. Bij de lockdown (0040) wordt dit vervangen door
-- 'authenticated only'; de leesfunctie hieronder blijft dan het enige anon-pad.
alter table collection_shares enable row level security;

drop policy if exists "anon read/write collection_shares" on collection_shares;
create policy "anon read/write collection_shares"
  on collection_shares for all
  using (true) with check (true);

-- 3. Gescoopt leespad: get_shared_collection_summary(token) ------------------
-- SECURITY DEFINER: draait als de eigenaar en omzeilt RLS, maar geeft ENKEL de
-- data van de collectie achter een geldig (niet-ingetrokken, niet-verlopen)
-- token terug. Ongeldig token -> null (de weergave toont dan 'link ongeldig').
-- Geen enkele andere collectie is via deze functie bereikbaar.
create or replace function get_shared_collection_summary(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_collection_id uuid;
  v_result        jsonb;
begin
  -- Token valideren + de bijhorende collectie bepalen.
  select s.collection_id
    into v_collection_id
  from collection_shares s
  where s.token = p_token
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now())
  limit 1;

  if v_collection_id is null then
    return null;  -- onbekend / ingetrokken / verlopen token
  end if;

  select jsonb_build_object(
    'collection', (
      select jsonb_build_object(
        'id',            c.id,
        'name',          c.name,
        'date',          c.date,
        'location',      c.location,
        'status',        c.status,
        'debrief_text',  c.debrief_text,
        'house_name',    h.name,
        'house_logo_url', h.logo_url
      )
      from collections c
      left join auction_houses h on h.id = c.house_id
      where c.id = v_collection_id
    ),
    'lots', coalesce((
      select jsonb_agg(l order by l.number nulls last, l.name)
      from (
        select
          lots.id, lots.number, lots.is_charity, lots.withdrawn,
          lots.collection_day_id, lots.name, lots.sold, lots.sale_price,
          lots.sale_channel, lots.time_hammer, lots.duration_seconds,
          lots.time_entered_ring, lots.time_bidding_start, lots.lot_type_id
        from lots
        where lots.collection_id = v_collection_id
      ) l
    ), '[]'::jsonb),
    'lot_types', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name_nl', t.name_nl))
      from lot_types t
      where t.id in (
        select distinct lots.lot_type_id from lots
        where lots.collection_id = v_collection_id and lots.lot_type_id is not null
      )
    ), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'day_index', d.day_index, 'date', d.date, 'label', d.label
      ) order by d.day_index)
      from collection_days d
      where d.collection_id = v_collection_id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

-- anon (niet-ingelogde ontvanger) én authenticated mogen de functie aanroepen.
revoke all on function get_shared_collection_summary(text) from public;
grant execute on function get_shared_collection_summary(text) to anon, authenticated;

commit;
