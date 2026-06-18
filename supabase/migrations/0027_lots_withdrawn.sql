-- Migratie 0027: lots.withdrawn (paard trekt zich terug uit de veiling).
--
-- Frederik wil per lot kunnen markeren dat het paard NIET deelneemt aan
-- de veiling (bv. uitgevallen door blessure, last-minute teruggetrokken
-- door verkoper). Het lot blijft volledig in de DB staan met al zijn
-- voorbereiding (notities, klanten, foto's, pedigree), maar wordt
-- overgeslagen tijdens de live cockpit en uitgesloten van de omzet-
-- berekeningen op de summary-pagina.
--
-- Gedrag per UI-component (zie cockpit/summary code):
--   - Cockpit: 'Vorig/Volgend' navigatie slaat withdrawn-lots over,
--     X/N voortgangsteller exclueert ze (N = totaal - withdrawn).
--   - AuctionPage: lot toont een 'Niet deelnemend'-badge.
--   - Summary: aparte sectie 'Niet-deelnemend', uitgesloten uit totalen.
--
-- Geen reason-veld — Frederik kan een verklaring in de notitievelden
-- kwijt indien gewenst.

alter table lots add column withdrawn boolean not null default false;
