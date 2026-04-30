-- Migratie 0005: drie URL-velden per lot
--
-- Frederik (30-04-2026) wil per lot drie placeholders waar hij URL's kan
-- intypen tijdens voorbereiding:
--   * url_hippomundo  → bv. www.hippomundo.com/horse/<naam>
--   * url_horsetelex  → bv. www.horsetelex.com/...
--   * url_extra       → vrije link (eigen referentie, andere site, …)
--
-- Allemaal nullable text — geen URL-validatie op DB-niveau.
--
-- Draai eenmalig in Supabase Dashboard → SQL Editor → Run.

alter table lots
  add column if not exists url_hippomundo text,
  add column if not exists url_horsetelex text,
  add column if not exists url_extra      text;
