-- Migratie 0011: pauzes (BIS-blokken) tussen lots
--
-- Een pauze hoort altijd "na lot N" — N = after_lot_number. Voor de
-- visuele weergave (sortering op lotnummer) wordt de pauze ingevoegd
-- direct na het lot met dat nummer. Het BIS-label "N BIS" wordt door
-- de UI gegenereerd op basis van after_lot_number.
--
-- Veilig: additieve migratie.

create table if not exists auction_breaks (
  id                uuid primary key default gen_random_uuid(),
  auction_id        uuid not null references auctions(id) on delete cascade,
  after_lot_number  int,
  title             text not null default 'Pauze',
  description       text,
  duration_minutes  int,
  created_at        timestamptz not null default now()
);

create index if not exists idx_auction_breaks_auction
  on auction_breaks(auction_id, after_lot_number);

alter table auction_breaks enable row level security;

create policy "anon read/write auction_breaks"
  on auction_breaks for all
  using (true) with check (true);
