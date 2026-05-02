-- Migratie 0009: spotters per veiling
--
-- Spotters zijn personen op de zaalvloer die signalen geven aan de
-- veilingmeester. Per veiling: een lijst met naam, locatie (vrije tekst
-- — bv. "links vlakbij", "rechts ver weg"), optioneel een foto-URL,
-- en een display_order voor links-naar-rechts sortering.
--
-- Veilig: additieve migratie, raakt geen bestaande data.

create table if not exists spotters (
  id             uuid primary key default gen_random_uuid(),
  auction_id     uuid not null references auctions(id) on delete cascade,
  name           text not null,
  location       text,
  photo_url      text,
  display_order  int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_spotters_auction
  on spotters(auction_id, display_order);

alter table spotters enable row level security;

create policy "anon read/write spotters"
  on spotters for all
  using (true) with check (true);
