-- Migratie 0008: gestructureerd pedigree-veld op lots
--
-- Het bestaande lots.pedigree_raw (text) blijft staan als raw-tekst
-- backup. Dit nieuwe veld bevat een 3-generatie pedigree-tree als JSON
-- zodat de UI er een bracket-layout van kan renderen.
--
-- Schema:
--   {
--     "sire": {
--       "name": "Chacco Blue",
--       "sire": { "name": "Chambertin", "sire": "Cambridge", "dam": "Desiree VII" },
--       "dam":  { "name": "Mom's Contara", "sire": "Contender",  "dam": "Godahra II" }
--     },
--     "dam":  { "name": "W Delta Mossel Jantje", "sire": {...}, "dam": {...} }
--   }
--
-- Conventie: ouders en grootouders zijn objecten met name + nested
-- sire/dam (strings of nested object); overgrootouders zijn strings
-- (geen verdere generatie nodig in deze MVP).
--
-- Veilig: additieve migratie, raakt geen bestaande data.

alter table lots
  add column if not exists pedigree jsonb;
