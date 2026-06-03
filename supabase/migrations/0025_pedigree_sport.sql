-- Migratie 0025: sportniveau + resultaat per moederlijn op lots
--
-- Per lot kan voor elk van de drie moederlijnen (moeder, moeders moeder,
-- moeders moeders moeder) worden vastgelegd op welk sportniveau die merrie
-- liep en met welk resultaat (Placed / Winner). Wordt bewerkt en getoond op
-- de lot-pagina, en naast de merrienaam in de pedigree-boom (LotPage + Cockpit).
--
-- Velden:
--   <lijn>_sport_level : niveau-label (bv. "1.50m", "Grand Prix") of null
--   <lijn>_result      : "Placed" / "Winner" of null
-- waarbij <lijn> ∈ { dam, damsdam, damsdamsdam }.
--
-- Veilig: additieve migratie, alle kolommen nullable, raakt geen data.

alter table lots
  add column if not exists dam_sport_level          text,
  add column if not exists dam_result               text,
  add column if not exists damsdam_sport_level       text,
  add column if not exists damsdam_result            text,
  add column if not exists damsdamsdam_sport_level   text,
  add column if not exists damsdamsdam_result        text;
