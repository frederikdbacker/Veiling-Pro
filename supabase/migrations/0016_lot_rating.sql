-- Migratie 0016: sterrenrating per lot (Fase 2 item #1)
--
-- Frederik en het organisatiecomité geven elk lot een rating 1-5 (hele
-- sterren, optioneel — paard mag rating-loos blijven). Eén rating per
-- paard, geen aparte sportief/commercieel-as.
--
-- Zichtbaar/bewerkbaar op LotPage, AuctionPage (sorteerbaar) en cockpit.
--
-- Additieve migratie. Geen impact op bestaande data.

alter table lots add column rating int;

alter table lots add constraint rating_range
  check (rating is null or rating between 1 and 5);
