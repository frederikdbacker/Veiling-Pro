-- Migratie 0014: notitievelden herstructureren (Fase 2 item #7)
--
-- Vijf rubrieken volgens POST_ALOGA_ROADMAP.md:
--   familie / resultaten / kenmerken / organisatie / bijzonderheden
--
-- Aanpak C uit overleg met Frederik (06-05-2026): we behouden de oude
-- kolommen notes_catalog en notes_video tijdelijk zodat hij per-lot kan
-- beslissen welke notities hij wil overzetten naar de nieuwe rubrieken.
-- Wanneer dat klaar is volgt migratie 0015 om de oude kolommen te
-- droppen. UI toont een "Verouderde notities"-blok dat de oude inhoud
-- read-only weergeeft tot ze leeggemaakt worden.
--
-- Geen data-verlies in deze migratie.

begin;

-- 1. Rename notes_org → notes_organisatie (data behouden)
alter table lots rename column notes_org to notes_organisatie;

-- 2. Vier nieuwe rubriek-kolommen toevoegen
alter table lots add column notes_familie         text;
alter table lots add column notes_resultaten      text;
alter table lots add column notes_kenmerken       text;
alter table lots add column notes_bijzonderheden  text;

-- 3. notes_catalog en notes_video blijven staan (zie aanpak C).
--    Geen wijziging hier; drop volgt in migratie 0015.

commit;
