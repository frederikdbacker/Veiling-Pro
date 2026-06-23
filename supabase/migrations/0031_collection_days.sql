-- Migratie 0031: veilingdagen — een collectie kan over meerdere dagen verkocht worden.
--
-- Context (zie docs/plan-meerdaagse-collectie-opsplitsing.md):
-- Tot nu toe = één collectie = één dag (collections.date is één DATE, de
-- cockpit draait als één doorlopende sessie over alle lots). Meerdaagse
-- verkopen (bv. Deauville Sélection: ma 29 + di 30 juni 2026; Fences Élite:
-- wo 2 t/m za 5 sept 2026) passen daar niet in.
--
-- Oplossing (robuust + volledig backward-compatible):
--   * Nieuwe kindtabel `collection_days` onder `collections`.
--   * Elk lot krijgt een nullable `collection_day_id` (welke veilingdag).
--   * De live-sessievelden (active_lot_id, sessietiming, status) verhuizen
--     naar dag-niveau zodat de cockpit per veilingdag draait.
--   * ELKE bestaande eendaagse collectie krijgt automatisch precies ÉÉN dag,
--     met alle lots eraan gekoppeld → niets aan bestaand gedrag verandert.
--
-- Wat collectie-breed BLIJFT (gedeeld over alle dagen): spotters, biedstaffels,
-- lot-types, klanten/seating. Pauzes gaan in een latere migratie (0032) naar
-- dag-niveau.
--
-- VEILIG: volledig additief + idempotent. GEEN bestaande kolom wordt gedropt
-- of hernoemd. collections.active_lot_id / time_auction_start / time_auction_end
-- blijven (gedeprecieerd) bestaan tot een latere opruim-migratie.
--
-- ⚠️ BACK-UP VÓÓR UITVOEREN (projectregel: backup vóór elke schemawijziging).
-- Draai dit bestand één keer in de Supabase SQL Editor.

begin;

-- 1. Tabel collection_days ---------------------------------------------------
create table if not exists collection_days (
  id                 uuid primary key default gen_random_uuid(),
  collection_id      uuid not null references collections(id) on delete cascade,
  day_index          int  not null,                 -- 1, 2, 3… volgorde binnen de verkoop
  label              text,                            -- bv. "Dag 1 — maandag" (optioneel)
  date               date,                            -- de échte datum van déze dag
  -- live-sessievelden, verhuisd van collections → per dag:
  active_lot_id      uuid references lots(id) on delete set null,
  time_session_start timestamptz,
  time_session_end   timestamptz,
  status             text default 'planned',          -- planned / lopend / afgesloten
  created_at         timestamptz not null default now(),
  unique (collection_id, day_index)
);

create index if not exists idx_collection_days_collection
  on collection_days(collection_id);

alter table collection_days enable row level security;

-- Permissive policy, consistent met de rest van het MVP-schema.
drop policy if exists "anon read/write collection_days" on collection_days;
create policy "anon read/write collection_days"
  on collection_days for all
  using (true) with check (true);

-- 2. lots.collection_day_id --------------------------------------------------
-- Nullable = "nog niet aan een dag toegewezen" (de unassigned-bak). Lots
-- zonder dag mogen nooit uit de UI verdwijnen. on delete set null: een dag
-- verwijderen maakt zijn lots weer ongetoewezen i.p.v. ze te wissen.
alter table lots
  add column if not exists collection_day_id uuid
  references collection_days(id) on delete set null;

create index if not exists idx_lots_collection_day
  on lots(collection_day_id);

-- 3. Backfill — elke bestaande collectie krijgt exact één dag ----------------
-- Idempotent: enkel een dag aanmaken voor collecties die er nog geen hebben.
-- day_index 1, datum/status/active_lot/sessietiming overgenomen van de collectie
-- zodat de cockpit (die voortaan op dag-niveau leest) exact dezelfde stand toont.
insert into collection_days
  (collection_id, day_index, date, status, active_lot_id, time_session_start, time_session_end)
select
  c.id, 1, c.date, coalesce(c.status, 'planned'),
  c.active_lot_id, c.time_auction_start, c.time_auction_end
from collections c
where not exists (
  select 1 from collection_days d where d.collection_id = c.id
);

-- Koppel alle nog-ongetoewezen lots aan dag 1 van hun collectie.
update lots l
set collection_day_id = d.id
from collection_days d
where d.collection_id = l.collection_id
  and d.day_index = 1
  and l.collection_day_id is null;

commit;

-- 4. Verificatie (handmatig draaien NA de migratie) --------------------------
-- Elke collectie heeft exact 1 dag, en elke dag heeft evenveel lots als de
-- collectie. Verwacht: 0 rijen uit beide checks.
--
--   -- collecties zonder precies 1 dag:
--   select c.id, c.name, count(d.id) as dagen
--   from collections c left join collection_days d on d.collection_id = c.id
--   group by c.id, c.name having count(d.id) <> 1;
--
--   -- lots die niet aan een dag hangen:
--   select count(*) from lots where collection_day_id is null;
