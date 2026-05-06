-- Migratie 0017: hengst-gekeurd-vinkje + stamboeken (Fase 2 item #11)
--
-- Twee additieve velden op lots, alleen relevant voor hengsten:
--   - stallion_approved   bool — gekeurd ja/nee (default false)
--   - approved_studbooks  text[] — één of meer stamboeken die de hengst
--                                  hebben goedgekeurd (default leeg)
--
-- UI:
--   - LotPage: vinkje + multi-select chips, alleen tonen wanneer
--     gender = hengst
--   - AuctionPage rij: "ggk" achter geslacht wanneer stallion_approved
--   - Cockpit: tekstregel "Gekeurd [stamboek1, stamboek2]" (read-only)
--
-- Geen DB-constraint op gender = hengst — UI-logica beheert dat. Toelaten
-- als historisch artefact bij gender-correcties.

alter table lots add column stallion_approved boolean not null default false;
alter table lots add column approved_studbooks text[] not null default '{}';
