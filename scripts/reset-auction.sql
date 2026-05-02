-- Reset alle live-veilingdata voor één specifieke veiling.
--
-- WANNEER GEBRUIKEN:
--   * Vóór een veiling, om test-hameringen weg te halen.
--   * Vóór een nieuwe veiling van hetzelfde huis (Aloga 2027 erft niet de
--     hamerings van 2026).
--
-- HOE GEBRUIKEN:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Plak dit bestand
--   3. Vervang het UUID hieronder als je een ándere veiling reset
--      (default: Aloga Auction 2026)
--   4. Run
--
-- VEILIG: gebruikt expliciete WHERE op auction_id, raakt geen andere veiling.

-- 1. Reset alle lot-tijdstempels en verkoopvelden voor deze veiling
UPDATE lots
SET
  time_entered_ring  = NULL,
  time_bidding_start = NULL,
  time_hammer        = NULL,
  duration_seconds   = NULL,
  sold               = NULL,
  sale_price         = NULL,
  sale_channel       = NULL,
  buyer              = NULL,
  buyer_country      = NULL
WHERE auction_id = 'bef304a5-29fc-47b3-af37-e808205ae60d';  -- Aloga Auction 2026

-- 2. Reset de cockpit-pointer (welk lot in de piste is)
UPDATE auctions
SET active_lot_id = NULL
WHERE id = 'bef304a5-29fc-47b3-af37-e808205ae60d';  -- Aloga Auction 2026

-- 3. Verificatie: deze query moet 0 retourneren als de reset gelukt is.
SELECT COUNT(*) AS lots_nog_gehamerd
FROM lots
WHERE auction_id = 'bef304a5-29fc-47b3-af37-e808205ae60d'
  AND time_hammer IS NOT NULL;

-- ===========================================================
-- 4. OPTIONEEL — wis test-klanten en alle bijhorende koppelingen
-- ===========================================================
--
-- Verwijder de '/*' en '*/' hieronder als je ook alle ingevoerde
-- klanten van het Aloga-huis wil wissen. Cascade-delete neemt
-- automatisch lot_interested_clients en client_auction_seating mee
-- via foreign-key constraints.
--
-- WAARSCHUWING: dit raakt ALLE klanten van Aloga, ook eventueel
-- echte (niet-test) klanten. Alleen runnen als je weet dat je
-- alleen test-data hebt staan.

/*
DELETE FROM clients
WHERE house_id = (
  SELECT id FROM auction_houses WHERE name = 'Aloga'
);

-- Verificatie: deze moet 0 zijn.
SELECT COUNT(*) AS klanten_resterend
FROM clients
WHERE house_id = (
  SELECT id FROM auction_houses WHERE name = 'Aloga'
);
*/
