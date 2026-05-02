-- Migratie 0012: online_bidding_enabled toggle per veiling
--
-- Default false: hamer-form in cockpit toont alleen "Verkocht in zaal"
-- en "Niet verkocht". Bij true verschijnt ook de "Verkocht online"-
-- optie in de radio-keuze.

alter table auctions
  add column if not exists online_bidding_enabled boolean not null default false;
