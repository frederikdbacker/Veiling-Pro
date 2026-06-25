-- 0036_archived.sql — archiveer-vlag voor veilingen en veilinghuizen.
-- Additief + idempotent: enkel kolommen toevoegen, geen drop/rename/data-mutatie.
-- Gearchiveerde items worden in de UI standaard verborgen (met een
-- "Toon gearchiveerd"-schakelaar), als veilig alternatief voor hard verwijderen.

alter table collections    add column if not exists archived boolean not null default false;
alter table auction_houses add column if not exists archived boolean not null default false;
