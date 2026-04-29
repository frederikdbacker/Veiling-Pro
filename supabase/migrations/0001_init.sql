-- Veiling Pro — initiële schema
-- Draai dit eenmalig in de Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → plakken → Run

-- =============================================================
-- 1. Auction houses
-- =============================================================
create table auction_houses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     text,
  website     text,
  contact     text,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (name)
);

-- =============================================================
-- 2. Auctions
-- =============================================================
create table auctions (
  id                  uuid primary key default gen_random_uuid(),
  house_id            uuid not null references auction_houses(id) on delete cascade,
  name                text not null,
  date                date,
  location            text,
  status              text default 'planned',
  notes               text,
  time_auction_start  timestamptz,
  time_auction_end    timestamptz,
  created_at          timestamptz not null default now(),
  unique (house_id, name)
);

create index idx_auctions_house on auctions(house_id);
create index idx_auctions_date  on auctions(date);

-- =============================================================
-- 3. Lots
-- =============================================================
create table lots (
  id                  uuid primary key default gen_random_uuid(),
  auction_id          uuid not null references auctions(id) on delete cascade,

  -- Lot-identificatie
  number              int,
  name                text,
  slug                text,

  -- Paard
  discipline          text,
  year                int,
  gender              text,
  size                text,
  studbook            text,
  sire                text,
  dam                 text,
  pedigree_raw        text,

  -- Catalogus / media
  catalog_text        text,
  equiratings_text    text,
  photos              jsonb default '[]'::jsonb,
  video_url           text,
  source_url          text,

  -- Prijzen
  start_price         numeric(10, 2),
  reserve_price       numeric(10, 2),
  bid_steps           numeric(10, 2),

  -- Veilingmeester-notities
  notes_catalog       text,
  notes_video         text,
  notes_org           text,
  usp                 text,
  strong_points       text,
  weak_points         text,

  -- Resultaat
  sold                boolean,
  sale_price          numeric(10, 2),
  buyer               text,
  buyer_country       text,

  -- Timing tijdens veiling
  time_entered_ring   timestamptz,
  time_hammer         timestamptz,
  duration_seconds    int,

  -- Metadata
  lot_type            text default 'horse',
  data_reliability    text,
  missing_info        jsonb default '[]'::jsonb,

  created_at          timestamptz not null default now()
);

create index idx_lots_auction on lots(auction_id);

-- =============================================================
-- 4. Row Level Security (RLS)
-- =============================================================
-- MVP-policies: open voor alle requests met de publishable key.
-- Zodra er auth komt, vervangen door per-user policies.
alter table auction_houses enable row level security;
alter table auctions       enable row level security;
alter table lots           enable row level security;

create policy "anon read/write auction_houses"
  on auction_houses for all
  using (true) with check (true);

create policy "anon read/write auctions"
  on auctions for all
  using (true) with check (true);

create policy "anon read/write lots"
  on lots for all
  using (true) with check (true);
