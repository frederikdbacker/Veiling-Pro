-- Migratie 0021: Fase 4 cockpit-vernieuwing — drie additieve kolommen.
--
-- #26 lots.spotter_id     — welke spotter heeft het winnende/laatste
--                           bod gemeld bij verkoop. FK naar spotters.id
--                           (ON DELETE SET NULL — als de globale spotter
--                           verdwijnt blijft het verkoopresultaat
--                           behouden, zonder spotter-attributie).
--
-- #12 lots.auction_order  — veilingvolgorde-index, los van lots.number
--                           (catalogusnummer). Drag-and-drop op
--                           CollectionPage werkt op deze kolom. Bij lots
--                           waarbij beide gelijk lopen: blijven gelijk.
--                           NULL toegestaan voor backward-compat;
--                           UI behandelt NULL als "valt achteraan".
--
-- #5  collections.rundown_text — vrij tekstveld voor de aankondigings-
--                           tekst die vóór lot 1 in de cockpit verschijnt.
--                           Per collectie aanpasbaar. Standaardsjabloon
--                           wordt door UI gevuld bij eerste edit.
--
-- Geen impact op bestaande data — alle 3 kolommen zijn additief.

begin;

alter table lots add column spotter_id uuid references spotters(id) on delete set null;

alter table lots add column auction_order int;

alter table collections add column rundown_text text;

commit;
