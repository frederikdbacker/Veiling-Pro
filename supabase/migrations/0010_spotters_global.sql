-- Migratie 0010: spotters globaal in plaats van per-veiling
--
-- Spotters werken voor meerdere veilinghuizen en veilingen. We
-- houden ze globaal bij in `spotters`, en de toewijzing aan een
-- specifieke veiling (met locatie en display_order) gaat via
-- de junction-tabel `auction_spotters`.
--
-- LET OP: dit dropt de oude per-veiling spotters tabel uit migratie
-- 0009. Eventuele test-data is verloren. OK zolang er nog geen
-- productie-spotters waren.

drop table if exists spotters;

create table spotters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  photo_url   text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_spotters_name on spotters(name);

create table auction_spotters (
  auction_id     uuid not null references auctions(id) on delete cascade,
  spotter_id     uuid not null references spotters(id) on delete cascade,
  location       text,
  display_order  int not null default 0,
  created_at     timestamptz not null default now(),
  primary key (auction_id, spotter_id)
);

create index if not exists idx_auction_spotters_auction
  on auction_spotters(auction_id, display_order);
create index if not exists idx_auction_spotters_spotter
  on auction_spotters(spotter_id);

alter table spotters         enable row level security;
alter table auction_spotters enable row level security;

create policy "anon read/write spotters"
  on spotters for all using (true) with check (true);

create policy "anon read/write auction_spotters"
  on auction_spotters for all using (true) with check (true);
