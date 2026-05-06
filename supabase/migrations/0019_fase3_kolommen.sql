-- Migratie 0019: Fase 3 kolommen — land bij klanten, bidding_mode bij
-- seating, logo_url bij veilinghuizen.
--
-- Drie additieve kolommen voor Fase 3 features:
--
-- #8  clients.country_code (ISO 3166-1 alpha-3, bv. "BEL", "BRA",
--     "NLD"). Gebruikt voor type-ahead-zoek + vlaggetje in UI.
-- #14 client_collection_seating.bidding_mode (text + check) — modus
--     onsite (in zaal) / online (vanop afstand via web-bidding) /
--     phone (telefonisch). Standaard onsite. Per (klant, collectie),
--     niet per lot.
-- #18 auction_houses.logo_url — URL naar het logo van het veilinghuis,
--     gebruikt voor "Auction page"-logo in cockpit.
--
-- Geen impact op bestaande data — alle 3 kolommen zijn additief.

begin;

alter table clients add column country_code text;

alter table client_collection_seating
  add column bidding_mode text not null default 'onsite'
  check (bidding_mode in ('onsite', 'online', 'phone'));

alter table auction_houses add column logo_url text;

commit;
