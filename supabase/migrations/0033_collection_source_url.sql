-- Migratie 0033: collections.source_url — bron-URL van een via-link opgehaalde collectie.
--
-- Context (zie docs/plan-plak-collectielink-ingest.md):
-- Frederik wil binnen een veilinghuis een collectie-link plakken en de
-- catalogus automatisch laten ophalen (URL-ingest). Tot nu toe legt niets
-- vast vanwáár een collectie werd geïmporteerd. Deze kolom bewaart die
-- bron-URL, nodig voor "opnieuw ophalen" en voor deduplicatie op
-- collectie-niveau.
--
-- VEILIG: volledig additief + idempotent. Nullable, geen default — bestaande
-- collecties blijven ongewijzigd (source_url = NULL = "handmatig/anders
-- aangemaakt"). Geen enkele kolom wordt gedropt of hernoemd.
--
-- ⚠️ BACK-UP VÓÓR UITVOEREN (projectregel: backup vóór elke schemawijziging).
-- Draai dit bestand één keer in de Supabase SQL Editor. Draai vóór 0034.

begin;

alter table collections
  add column if not exists source_url text;

comment on column collections.source_url is
  'Bron-URL waarvan deze collectie via de URL-ingest (plak-collectielink) is opgehaald (nullable).';

commit;
