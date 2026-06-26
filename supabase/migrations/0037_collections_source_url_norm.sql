-- Migratie 0037: collections.source_url_norm — gegenereerde, genormaliseerde
-- bron-URL + uniek slot, voor dedupe op de link.
--
-- Context: "Collectie ophalen" voor een veiling die al bestaat (zelfde link)
-- maakte een tweede collectie aan, omdat de importer op (house_id, name) matcht
-- en de scraper soms een licht andere veilingnaam teruggeeft. We herkennen een
-- veiling voortaan aan zijn LINK, niet aan zijn naam.
--
-- Deze kolom is GEGENEREERD: de database leidt de genormaliseerde link zelf af
-- uit source_url, zodat niemand hem hoeft bij te houden en hij per definitie
-- gelijk blijft aan de JS-helper normalizeSourceUrl() in src/lib/scraperRegistry.js.
-- De transformatie MOET teken-voor-teken gelijk zijn aan die helper:
--   lower( strip-trailing-slash( strip-vanaf-?-of-#( btrim(source_url) ) ) )
--
-- Het partiële unieke slot voorkomt dat er ooit twee collecties met dezelfde
-- (genormaliseerde) link bestaan. Link-loze collecties (source_url NULL) krijgen
-- source_url_norm = NULL en worden door het partiële slot genegeerd.
--
-- VEILIG: volledig additief + idempotent. Niets wordt gedropt/hernoemd; geen
-- data-mutatie (de gegenereerde kolom wordt door Postgres berekend). Vooraf
-- geverifieerd: 0 botsende genormaliseerde links op de live-DB.

begin;

alter table collections
  add column if not exists source_url_norm text
  generated always as (
    case
      when nullif(btrim(source_url), '') is null then null
      else lower(regexp_replace(regexp_replace(btrim(source_url), '[?#].*$', ''), '/+$', ''))
    end
  ) stored;

comment on column collections.source_url_norm is
  'Genormaliseerde source_url (lower + query/fragment gestript + trailing slash weg), '
  'gegenereerd; moet gelijk zijn aan normalizeSourceUrl() in scraperRegistry.js. '
  'Basis voor het dedupe-slot op de collectie-link.';

create unique index if not exists collections_source_url_norm_key
  on collections (source_url_norm)
  where source_url_norm is not null;

commit;
