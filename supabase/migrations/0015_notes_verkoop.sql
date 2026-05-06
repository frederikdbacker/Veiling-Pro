-- Migratie 0015: notitieveld "Opmerkingen verkoop" — alleen zichtbaar in cockpit
--
-- Frederik wil tijdens of na de veiling van een lot opmerkingen kunnen
-- noteren over wat er gebeurd is (bijzonderheden in het bieden, koper-
-- gedrag, technische incidenten, etc.). Dit veld is bewust:
--   - Niet zichtbaar op LotPage (geen prep-notitie)
--   - Wel altijd zichtbaar in cockpit (zelfs als leeg, om snel te kunnen
--     beginnen typen tijdens live veiling)
--
-- Additieve migratie, geen impact op bestaande data.

alter table lots add column notes_verkoop text;
