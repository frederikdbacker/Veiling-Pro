-- Migratie 0004: cockpit + klanten-fundament
--
-- Schema-uitbreiding voor de live cockpit + klanten-CRM (kern):
--   * auctions.active_lot_id   → onthoud welk lot in de piste is
--   * lots.time_bidding_start  → drie-knop-flow tijdens veiling
--                                (in de piste → start bieden → hamer)
--   * clients                  → klanten-tabel
--   * lot_interested_clients   → many-to-many koppeling naar lots
--
-- Klanten-UI op LotPage volgt later (stap 0b in plan, momenteel
-- uitgesteld). Cockpit toont read-only klantenlijst zodra koppelingen
-- bestaan; voorlopig leeg.
--
-- Draai eenmalig in Supabase Dashboard → SQL Editor → Run.

-- =============================================================
-- 1. auctions.active_lot_id
-- =============================================================
alter table auctions
  add column if not exists active_lot_id uuid
    references lots(id) on delete set null;

-- =============================================================
-- 2. lots.time_bidding_start
-- =============================================================
alter table lots
  add column if not exists time_bidding_start timestamptz;

-- =============================================================
-- 3. clients — kern van het klanten-CRM
-- =============================================================
create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     text,
  notes       text,
  contact     text,
  created_at  timestamptz not null default now()
);

-- Bewust GEEN unique-constraint op naam — Frederik kan in praktijk
-- meerdere klanten met dezelfde naam hebben (verschillende personen,
-- of typfouten). Dedup gebeurt later in de UI via autocomplete.

-- =============================================================
-- 4. lot_interested_clients — junction
-- =============================================================
create table lot_interested_clients (
  lot_id       uuid not null references lots(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  notes        text,
  created_at   timestamptz not null default now(),
  primary key (lot_id, client_id)
);

create index idx_lot_interested_lot     on lot_interested_clients(lot_id);
create index idx_lot_interested_client  on lot_interested_clients(client_id);

-- =============================================================
-- 5. RLS — zelfde permissive patroon als overige tabellen
-- =============================================================
alter table clients                enable row level security;
alter table lot_interested_clients enable row level security;

create policy "anon read/write clients"
  on clients for all
  using (true) with check (true);

create policy "anon read/write lot_interested_clients"
  on lot_interested_clients for all
  using (true) with check (true);
