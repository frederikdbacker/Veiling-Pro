-- Migratie 0006: sale_channel op lots
--
-- Frederik (30-04-2026) wil bij elke verkoop noteren of het lot in de
-- zaal of online verkocht is. Eén nullable text-kolom, geldige waarden:
--   'zaal'   — verkocht aan kopier in de zaal
--   'online' — verkocht via online-platform
--   null     — niet verkocht of nog niet gehamerd
--
-- Geen DB-niveau enum/check (Frederik kan in toekomst meer kanalen toevoegen).
--
-- Draai eenmalig in Supabase Dashboard → SQL Editor → Run.

alter table lots
  add column if not exists sale_channel text;
