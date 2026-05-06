-- Migratie 0013: lot_type verplicht + auto-derive-marker
--
-- Onderdeel van Fase 2 item #13 uit POST_ALOGA_ROADMAP.md.
--
-- Twee veranderingen:
-- 1. lots.lot_type_id wordt NOT NULL — geen lot zonder type
-- 2. nieuwe kolom lots.lot_type_auto (bool, default false) — flag dat
--    het type automatisch is afgeleid bij import (geen jaar → embryo,
--    jaar = lopend kalenderjaar → veulen). UI toont een marker
--    "automatisch toegekend, klik om te wijzigen". Wanneer de gebruiker
--    het type expliciet wijzigt via de dropdown, wordt deze flag op
--    false gezet (zie src/components/LotTypeDropdown.jsx).
--
-- Pre-check (vóór deze migratie):
--   SELECT COUNT(*) FROM lots WHERE lot_type_id IS NULL;
-- Resultaat moet 0 zijn — anders blokkeert SET NOT NULL.

begin;

-- Migratie A: NOT NULL constraint
alter table lots alter column lot_type_id set not null;

-- Migratie B: lot_type_auto kolom
alter table lots add column lot_type_auto boolean not null default false;

commit;
