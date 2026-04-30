-- Migratie: bid_steps verhuizen van lots naar auctions
--
-- Reden: een biedstap geldt per veiling (organisatie-afspraak),
-- niet per paard. Frederik (20+ jaar veilingmeester) heeft dit
-- bevestigd op 2026-04-30.
--
-- Draai dit eenmalig in de Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → plakken → Run

-- =============================================================
-- 1. Nieuwe kolom op auctions
-- =============================================================
alter table auctions
  add column if not exists bid_steps numeric(10, 2);

-- =============================================================
-- 2. "bid_steps" uit elke lot.missing_info-array verwijderen
-- =============================================================
-- De jsonb '-'-operator verwijdert matchende string-elementen
-- uit een jsonb-array.
update lots
   set missing_info = missing_info - 'bid_steps'
 where missing_info ? 'bid_steps';

-- =============================================================
-- 3. (Niet nu) lots.bid_steps droppen
-- =============================================================
-- De kolom lots.bid_steps blijft voorlopig staan: deprecated maar
-- leeg op alle 24 import-rijen. Drop in een latere migratie zodra
-- alle code en import-scripts geen referentie meer maken.
