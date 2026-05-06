-- Migratie 0018: rename auctions → collections + alle FK-kolommen + junctions
--
-- Onderdeel van Fase 1.5 uit POST_ALOGA_ROADMAP.md (item #17). Alle
-- `auction*`-tabellen behalve `auction_houses` worden hernoemd voor
-- consistentie met de nieuwe terminologie. `auction_houses` blijft staan.
--
-- BELANGRIJK: Postgres update FK-constraints automatisch bij RENAME.
-- Indices behouden hun naam (cosmetisch verschil, niet functioneel).
--
-- Uit te voeren NA: code-deploy met gewijzigde queries
--   - Of vooraf, met snel daarna pushen — er is een 30s-1min venster
--     waarin oude JS in browser-tabs faalt.

begin;

-- 1. Hoofdtabel
alter table auctions rename to collections;

-- 2. FK-kolommen op alle 6 tabellen (lots + 5 junctions)
alter table lots                   rename column auction_id to collection_id;
alter table auction_lot_types      rename column auction_id to collection_id;
alter table bid_step_rules         rename column auction_id to collection_id;
alter table auction_breaks         rename column auction_id to collection_id;
alter table auction_spotters       rename column auction_id to collection_id;
alter table client_auction_seating rename column auction_id to collection_id;

-- 3. Junction-tabellen renamen voor consistentie
alter table auction_lot_types      rename to collection_lot_types;
alter table auction_breaks         rename to collection_breaks;
alter table auction_spotters       rename to collection_spotters;
alter table client_auction_seating rename to client_collection_seating;

commit;
