-- Migratie 0020: foto-URL bij klanten (#22 uit POST_ALOGA_ROADMAP.md).
--
-- Klanten kunnen een foto krijgen voor visuele herkenning in cockpit
-- en op de globale klantenlijst-overzichtspagina. Foto wordt geüpload
-- via Supabase Storage (bucket "client-photos", public). De URL wordt
-- hier bewaard.
--
-- Spotters hebben al een photo_url-kolom uit migratie 0010.
-- Additieve migratie, geen impact op bestaande data.

alter table clients add column photo_url text;
