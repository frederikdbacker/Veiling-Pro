-- Migratie 0003: bid-step-systeem
--
-- Gebaseerd op Frederik's domein-input (30-04-2026):
--   * lot-types als referentietabel (uitbreidbaar door gebruiker)
--   * per veiling: kies welke types aanwezig zijn
--   * per (veiling, type): bid-staffel met ranges en step-bedragen
--   * lots krijgen een FK lot_type_id naar lot_types
--
-- Conventie staffel-ranges (Frederik's bevestiging):
--   * range_from is INCLUSIEF, range_to is EXCLUSIEF — dus [from, to)
--   * range_to = NULL betekent "tot oneindig" (laatste regel)
--
-- Draai eenmalig in Supabase Dashboard → SQL Editor → Run.

-- =============================================================
-- 1. lot_types — referentie + seed (8 types)
-- =============================================================
create table lot_types (
  id              uuid primary key default gen_random_uuid(),
  key             text unique not null,
  name_nl         text not null,
  display_order   int default 100,
  created_at      timestamptz not null default now()
);

insert into lot_types (key, name_nl, display_order) values
  ('foal',                'Veulen',                10),
  ('embryo',              'Embryo',                20),
  ('surrogate',           'Draagmoeder',           30),
  ('breeding-mare',       'Fokmerrie',             40),
  ('stallion-approved',   'Hengst gekeurd',        50),
  ('stallion-unapproved', 'Hengst niet gekeurd',   60),
  ('sport-jumping',       'Sportpaard springen',   70),
  ('sport-dressage',      'Sportpaard dressuur',   80)
on conflict (key) do nothing;

-- =============================================================
-- 2. auction_lot_types — junction (welke types in welke veiling)
-- =============================================================
create table auction_lot_types (
  auction_id     uuid not null references auctions(id)  on delete cascade,
  lot_type_id    uuid not null references lot_types(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (auction_id, lot_type_id)
);

-- =============================================================
-- 3. bid_step_rules — de staffels
-- =============================================================
create table bid_step_rules (
  id              uuid primary key default gen_random_uuid(),
  auction_id      uuid not null references auctions(id)  on delete cascade,
  lot_type_id     uuid not null references lot_types(id) on delete cascade,
  range_from      numeric(10, 2) not null default 0,
  range_to        numeric(10, 2),
  step            numeric(10, 2) not null,
  created_at      timestamptz not null default now()
);

create index idx_bid_step_rules_lookup
  on bid_step_rules(auction_id, lot_type_id, range_from);

-- =============================================================
-- 4. lots.lot_type_id — FK naar lot_types
-- =============================================================
alter table lots
  add column if not exists lot_type_id uuid references lot_types(id);

create index if not exists idx_lots_lot_type on lots(lot_type_id);

-- Note: bestaande tekst-kolom lots.lot_type (default 'horse') blijft staan,
-- deprecated. Drop in latere schoonmaak zodra alle UI en cockpit-code de
-- nieuwe FK gebruiken.

-- =============================================================
-- 5. RLS — zelfde permissive patroon als overige tabellen
-- =============================================================
alter table lot_types          enable row level security;
alter table auction_lot_types  enable row level security;
alter table bid_step_rules     enable row level security;

create policy "anon read/write lot_types"
  on lot_types for all
  using (true) with check (true);

create policy "anon read/write auction_lot_types"
  on auction_lot_types for all
  using (true) with check (true);

create policy "anon read/write bid_step_rules"
  on bid_step_rules for all
  using (true) with check (true);
