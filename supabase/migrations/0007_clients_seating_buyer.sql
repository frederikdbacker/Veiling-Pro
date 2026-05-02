-- Migratie 0007: klanten-UI met seating per veiling + koper-tracking
--
-- Drie wijzigingen:
--   1. clients.house_id  → klant hoort bij een veilinghuis (niet aan
--      één veiling). Autocomplete kan klanten over meerdere veilingen
--      van hetzelfde huis hergebruiken.
--   2. client_auction_seating  → tafelnummer / richting / opmerking per
--      (klant, veiling). Janssens kan in 2026 op tafel 12 zitten en in
--      2027 op tafel 5; beide blijven bewaard.
--   3. lots.buyer_client_id  → koppeling naar clients voor de koper.
--      Bestaand lots.buyer (text) blijft staan voor backwards compat;
--      verdwijnt later in een schoonmaak-migratie.
--
-- Draai eenmalig in Supabase Dashboard → SQL Editor → Run.
-- Veilig: alle wijzigingen zijn additief, geen kolommen worden gedropt
-- en geen data wordt verplaatst (clients-tabel is leeg op moment van
-- deze migratie, dus geen backfill nodig).

-- =============================================================
-- 1. clients.house_id  (klant ↔ veilinghuis)
-- =============================================================
alter table clients
  add column if not exists house_id uuid
    references auction_houses(id) on delete cascade;

-- NOT NULL is netter voor toekomstige integriteit, maar zou bestaande
-- rijen breken (er zijn er nog geen, maar safe-by-default). Frederik
-- vult de UI-flow zo in dat house_id altijd wordt gezet bij insert.
-- Een toekomstige migratie kan dit veld op NOT NULL zetten zodra de
-- tabel productie-data heeft.

create index if not exists idx_clients_house on clients(house_id);

-- =============================================================
-- 2. client_auction_seating  (tafel/richting per klant per veiling)
-- =============================================================
create table if not exists client_auction_seating (
  client_id     uuid not null references clients(id) on delete cascade,
  auction_id    uuid not null references auctions(id) on delete cascade,
  table_number  text,
  direction     text,
  notes         text,
  created_at    timestamptz not null default now(),
  primary key (client_id, auction_id)
);

create index if not exists idx_seating_auction on client_auction_seating(auction_id);

alter table client_auction_seating enable row level security;

create policy "anon read/write client_auction_seating"
  on client_auction_seating for all
  using (true) with check (true);

-- =============================================================
-- 3. lots.buyer_client_id  (koper als clients-koppeling)
-- =============================================================
alter table lots
  add column if not exists buyer_client_id uuid
    references clients(id) on delete set null;

create index if not exists idx_lots_buyer_client on lots(buyer_client_id);
